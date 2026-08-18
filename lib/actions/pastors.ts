"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { pastorSchema, assignmentSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

async function audit(
  orgId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ?? undefined,
    },
  })
}

export async function createPastor(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = pastorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

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

  const parsed = pastorSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await prisma.pastor.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Pastor no encontrado" }

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
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Fecha inválida" }

  // The day the previous assignment ends: one day before the new start.
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)

  const [pastor, district] = await Promise.all([
    prisma.pastor.findFirst({ where: { id: pastorId, organizationId: ctx.organizationId, archivedAt: null } }),
    prisma.district.findFirst({ where: { id: districtId, organizationId: ctx.organizationId, archivedAt: null } }),
  ])
  if (!pastor) return { ok: false, error: "Pastor inválido" }
  if (!district) return { ok: false, error: "Distrito inválido" }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Close whoever currently leads this district.
      await tx.pastorAssignment.updateMany({
        where: { districtId, endDate: null, organizationId: ctx.organizationId },
        data: { endDate: prevEnd },
      })
      // 2. Close this pastor's current assignment elsewhere.
      await tx.pastorAssignment.updateMany({
        where: { pastorId, endDate: null, organizationId: ctx.organizationId },
        data: { endDate: prevEnd },
      })
      // 3. Open the new assignment.
      await tx.pastorAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          pastorId,
          districtId,
          startDate: start,
          endDate: null,
          createdById: ctx.userId,
        },
      })
    })
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
