"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { statisticSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

/**
 * Upsert a statistic record for a (church, year, month) key.
 *
 * Statistics are append-only by convention; correcting a value updates the
 * existing row (unique on churchId+year+month) and leaves an audit trail via
 * updatedById + AuditLog. Historical records are never silently overwritten by
 * unrelated operations — only an explicit edit here touches them.
 */
export async function upsertStatistic(input: unknown): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const parsed = statisticSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const month = data.period === "MONTHLY" ? data.month! : null

  const church = await prisma.church.findFirst({
    where: { id: data.churchId, organizationId: ctx.organizationId },
  })
  if (!church) return { ok: false, error: "Iglesia no encontrada" }

  const record = await prisma.statisticRecord.upsert({
    where: {
      churchId_year_month: { churchId: data.churchId, year: data.year, month: month },
    },
    create: {
      organizationId: ctx.organizationId,
      churchId: data.churchId,
      period: data.period,
      year: data.year,
      month,
      memberCount: data.memberCount,
      baptismCount: data.baptismCount,
      createdById: ctx.userId,
      updatedById: ctx.userId,
    },
    update: {
      memberCount: data.memberCount,
      baptismCount: data.baptismCount,
      updatedById: ctx.userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "statistic.upsert",
      entityType: "statisticRecord",
      entityId: record.id,
      metadata: {
        churchId: data.churchId,
        year: data.year,
        month,
        memberCount: data.memberCount,
        baptismCount: data.baptismCount,
      },
    },
  })

  revalidatePath(`/churches/${data.churchId}`)
  revalidatePath("/churches")
  revalidatePath("/districts")
  revalidatePath("/")
  return { ok: true, id: record.id }
}

export async function deleteStatistic(id: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const record = await prisma.statisticRecord.findFirst({
    where: { id, organizationId: ctx.organizationId },
  })
  if (!record) return { ok: false, error: "Registro no encontrado" }

  await prisma.statisticRecord.delete({ where: { id } })
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "statistic.delete",
      entityType: "statisticRecord",
      entityId: id,
      metadata: { churchId: record.churchId, year: record.year, month: record.month },
    },
  })

  revalidatePath(`/churches/${record.churchId}`)
  return { ok: true }
}
