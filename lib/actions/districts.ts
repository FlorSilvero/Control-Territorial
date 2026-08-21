"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { districtSchema, idSchema } from "@/lib/validations"
import { audit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export async function createDistrict(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = districtSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const district = await prisma.district.create({
    data: {
      organizationId: ctx.organizationId,
      name: parsed.data.name,
      notes: parsed.data.notes || null,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "district.create", "district", district.id, {
    name: district.name,
  })

  revalidatePath("/districts")
  return { ok: true, id: district.id }
}

export async function updateDistrict(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Distrito no encontrado" }

  const parsed = districtSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await prisma.district.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Distrito no encontrado" }

  await prisma.district.update({
    where: { id },
    data: {
      name: parsed.data.name,
      notes: parsed.data.notes || null,
      updatedById: ctx.userId,
    },
  })
  await audit(ctx.organizationId, ctx.userId, "district.update", "district", id)

  revalidatePath("/districts")
  revalidatePath(`/districts/${id}`)
  return { ok: true, id }
}

export async function archiveDistrict(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Distrito no encontrado" }

  const existing = await prisma.district.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { churches: { where: { archivedAt: null } } },
  })
  if (!existing) return { ok: false, error: "Distrito no encontrado" }
  if (existing.churches.length > 0) {
    return {
      ok: false,
      error: "No se puede archivar un distrito con iglesias activas. Archivá o reasigná las iglesias primero.",
    }
  }

  await prisma.district.update({ where: { id }, data: { archivedAt: new Date() } })
  await audit(ctx.organizationId, ctx.userId, "district.archive", "district", id)

  revalidatePath("/districts")
  revalidatePath("/archived")
  return { ok: true }
}

export async function restoreDistrict(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Distrito no encontrado" }

  const existing = await prisma.district.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!existing) return { ok: false, error: "Distrito no encontrado" }

  await prisma.district.update({ where: { id }, data: { archivedAt: null } })
  await audit(ctx.organizationId, ctx.userId, "district.restore", "district", id)

  revalidatePath("/districts")
  revalidatePath("/archived")
  return { ok: true }
}
