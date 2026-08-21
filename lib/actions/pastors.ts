"use server"

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/lib/generated/prisma/client"
import { requireSession, canEdit } from "@/lib/session"
import { pastorSchema, assignmentSchema, idSchema } from "@/lib/validations"
import { normalizeText } from "@/lib/utils"
import { audit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

/**
 * Reassign a pastor to a district within an existing transaction. THE
 * critical operation, shared by the single-assignment UI flow (`assignPastor`)
 * and bulk Excel import (`importPastors`):
 *
 *  1. Close the district's current assignment (endDate = day before start).
 *  2. Close the pastor's current assignment elsewhere, if any.
 *  3. Create the new active assignment (endDate = null).
 *
 * Historical rows are never modified — only the previously-open row is closed.
 */
export async function reassignPastorTx(
  tx: Prisma.TransactionClient,
  args: {
    organizationId: string
    pastorId: string
    districtId: string
    start: Date
    createdById: string
  },
): Promise<void> {
  const { organizationId, pastorId, districtId, start, createdById } = args

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)

  await tx.pastorAssignment.updateMany({
    where: { districtId, endDate: null, organizationId },
    data: { endDate: prevEnd },
  })
  await tx.pastorAssignment.updateMany({
    where: { pastorId, endDate: null, organizationId },
    data: { endDate: prevEnd },
  })
  await tx.pastorAssignment.create({
    data: {
      organizationId,
      pastorId,
      districtId,
      startDate: start,
      endDate: null,
      createdById,
    },
  })
}

/**
 * Accent- and case-insensitive first+last name match anywhere in the org,
 * active or archived — an archived match should be restored (keeping its
 * assignment and statistics history) instead of masked by a fresh duplicate
 * record. Postgres ILIKE can't strip diacritics via Prisma, so this compares
 * normalized text in JS ("Jose" must match "José").
 */
async function findDuplicatePastor(
  orgId: string,
  firstName: string,
  lastName: string,
  excludeId?: string,
) {
  const candidates = await prisma.pastor.findMany({
    where: { organizationId: orgId, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true, firstName: true, lastName: true, archivedAt: true },
  })
  const targetFirst = normalizeText(firstName)
  const targetLast = normalizeText(lastName)
  return (
    candidates.find(
      (p) => normalizeText(p.firstName) === targetFirst && normalizeText(p.lastName) === targetLast,
    ) ?? null
  )
}

function duplicatePastorError(duplicate: { archivedAt: Date | null }): string {
  return duplicate.archivedAt
    ? "Ya existe un pastor archivado con ese nombre y apellido. Restauralo desde Archivados en lugar de crear uno nuevo."
    : "Ya existe un pastor con ese nombre y apellido"
}

export async function createPastor(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = pastorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const duplicate = await findDuplicatePastor(ctx.organizationId, parsed.data.firstName, parsed.data.lastName)
  if (duplicate) return { ok: false, error: duplicatePastorError(duplicate) }

  const pastor = await prisma.pastor.create({
    data: {
      organizationId: ctx.organizationId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "pastor.create", "pastor", pastor.id, {
    name: `${pastor.firstName} ${pastor.lastName}`,
  })

  revalidatePath("/pastors")
  return { ok: true, id: pastor.id }
}

export async function updatePastor(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Pastor no encontrado" }

  const parsed = pastorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await prisma.pastor.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Pastor no encontrado" }

  const duplicate = await findDuplicatePastor(ctx.organizationId, parsed.data.firstName, parsed.data.lastName, id)
  if (duplicate) return { ok: false, error: duplicatePastorError(duplicate) }

  await prisma.pastor.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "pastor.update", "pastor", id)

  revalidatePath("/pastors")
  revalidatePath(`/pastors/${id}`)
  return { ok: true, id }
}

export async function archivePastor(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Pastor no encontrado" }

  const existing = await prisma.pastor.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { assignments: { where: { endDate: null } } },
  })
  if (!existing) return { ok: false, error: "Pastor no encontrado" }
  if (existing.assignments.length > 0) {
    return {
      ok: false,
      error: "No se puede archivar un pastor con una asignación activa. Finalizá su asignación primero.",
    }
  }

  await prisma.pastor.update({ where: { id }, data: { archivedAt: new Date() } })
  await audit(ctx.organizationId, ctx.userId, "pastor.archive", "pastor", id)

  revalidatePath("/pastors")
  revalidatePath("/archived")
  return { ok: true }
}

export async function restorePastor(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Pastor no encontrado" }

  const existing = await prisma.pastor.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Pastor no encontrado" }

  await prisma.pastor.update({ where: { id }, data: { archivedAt: null } })
  await audit(ctx.organizationId, ctx.userId, "pastor.restore", "pastor", id)

  revalidatePath("/pastors")
  revalidatePath("/archived")
  return { ok: true }
}

/**
 * Assign a pastor to a district. THE critical operation.
 *
 * In a single transaction:
 *  1. Close the district's current assignment (endDate = day before start).
 *  2. Close the pastor's current assignment elsewhere, if any.
 *  3. Create the new active assignment (endDate = null).
 *
 * Historical rows are never modified — only the previously-open row is closed.
 */
export async function assignPastor(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = assignmentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { pastorId, districtId, startDate } = parsed.data
  // Parse "YYYY-MM-DD" as a local date, not UTC — `new Date(startDate)` would
  // parse it as UTC midnight, which shifts a day earlier in negative-UTC-offset
  // timezones once displayed.
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number)
  const start = new Date(startYear, (startMonth ?? 1) - 1, startDay ?? 1)
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Fecha inválida" }

  const [pastor, district] = await Promise.all([
    prisma.pastor.findFirst({ where: { id: pastorId, organizationId: ctx.organizationId, archivedAt: null } }),
    prisma.district.findFirst({ where: { id: districtId, organizationId: ctx.organizationId, archivedAt: null } }),
  ])
  if (!pastor) return { ok: false, error: "Pastor inválido" }
  if (!district) return { ok: false, error: "Distrito inválido" }

  try {
    await prisma.$transaction((tx) =>
      reassignPastorTx(tx, {
        organizationId: ctx.organizationId,
        pastorId,
        districtId,
        start,
        createdById: ctx.userId,
      }),
    )
  } catch {
    return { ok: false, error: "No se pudo completar la reasignación" }
  }

  await audit(ctx.organizationId, ctx.userId, "pastor.reassign", "pastor", pastorId, {
    districtId,
    startDate,
  })

  revalidatePath("/pastors")
  revalidatePath(`/pastors/${pastorId}`)
  revalidatePath("/districts")
  revalidatePath(`/districts/${districtId}`)
  revalidatePath("/churches")
  return { ok: true }
}

/** End a pastor's current assignment without immediately assigning a successor. */
export async function endAssignment(assignmentId: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(assignmentId).success) return { ok: false, error: "Asignación no encontrada o ya finalizada" }

  const assignment = await prisma.pastorAssignment.findFirst({
    where: { id: assignmentId, organizationId: ctx.organizationId, endDate: null },
  })
  if (!assignment) return { ok: false, error: "Asignación no encontrada o ya finalizada" }

  await prisma.pastorAssignment.update({
    where: { id: assignmentId },
    data: { endDate: new Date() },
  })
  await audit(ctx.organizationId, ctx.userId, "pastor.endAssignment", "pastor", assignment.pastorId)

  revalidatePath("/pastors")
  revalidatePath(`/pastors/${assignment.pastorId}`)
  revalidatePath("/districts")
  revalidatePath(`/districts/${assignment.districtId}`)
  return { ok: true }
}
