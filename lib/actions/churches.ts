"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { churchSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

async function audit(
  orgId: string,
  actorId: string,
  action: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId,
      action,
      entityType: "church",
      entityId,
      metadata: metadata ?? undefined,
    },
  })
}

async function assertDistrict(orgId: string, districtId: string) {
  const d = await prisma.district.findFirst({
    where: { id: districtId, organizationId: orgId, archivedAt: null },
  })
  return !!d
}

export async function createChurch(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = churchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  if (!(await assertDistrict(ctx.organizationId, parsed.data.districtId))) {
    return { ok: false, error: "Distrito inválido" }
  }

  const church = await prisma.church.create({
    data: {
      organizationId: ctx.organizationId,
      name: parsed.data.name,
      districtId: parsed.data.districtId,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "church.create", church.id, {
    name: church.name,
  })

  revalidatePath("/churches")
  revalidatePath(`/districts/${parsed.data.districtId}`)
  return { ok: true, id: church.id }
}

export async function updateChurch(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = churchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await prisma.church.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Iglesia no encontrada" }

  if (!(await assertDistrict(ctx.organizationId, parsed.data.districtId))) {
    return { ok: false, error: "Distrito inválido" }
  }

  await prisma.church.update({
    where: { id },
    data: {
      name: parsed.data.name,
      districtId: parsed.data.districtId,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "church.update", id)

  revalidatePath("/churches")
  revalidatePath(`/churches/${id}`)
  return { ok: true, id }
}

export async function archiveChurch(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const existing = await prisma.church.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Iglesia no encontrada" }

  await prisma.church.update({ where: { id }, data: { archivedAt: new Date() } })
  await audit(ctx.organizationId, ctx.userId, "church.archive", id)

  revalidatePath("/churches")
  revalidatePath("/archived")
  return { ok: true }
}

export async function restoreChurch(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const existing = await prisma.church.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Iglesia no encontrada" }

  await prisma.church.update({ where: { id }, data: { archivedAt: null } })
  await audit(ctx.organizationId, ctx.userId, "church.restore", id)

  revalidatePath("/churches")
  revalidatePath("/archived")
  return { ok: true }
}
