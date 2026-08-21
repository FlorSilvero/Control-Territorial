"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { normalizeText } from "@/lib/utils"
import { readWorkbookRows } from "@/lib/excel"
import { resolveMemberCarryForward } from "@/lib/stats"
import { audit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }
export type ImportStatisticsSummary = { saved: number; errors: ImportRowError[] }
export type ImportStatisticsResult =
  | { ok: true; summary: ImportStatisticsSummary }
  | { ok: false; error: string }

const CURRENT_YEAR = new Date().getFullYear()

type ParsedRow = {
  rowNum: number
  churchId: string
  year: number
  month: number
  membersText: string
  baptisms: number
}

/** Higher key = more recent. Mirrors sortKey() in lib/stats.ts. */
function sortKey(year: number, month: number): number {
  return year * 13 + month
}

/**
 * Bulk-loads monthly church statistics from an .xlsx file (see
 * components/districts/import-district-stats-dialog.tsx for the expected
 * columns). memberCount is a stock: a blank "Miembros" cell carries forward
 * the most recent known value for that church — either from the database or
 * from an earlier row of the same import, whichever is more recent — instead
 * of being treated as zero. baptismCount is a flow: it's the period's raw
 * value, not summed onto whatever was already stored for that month.
 */
export async function importDistrictStatistics(formData: FormData): Promise<ImportStatisticsResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  let rawRows: Record<string, string>[]
  try {
    rawRows = await readWorkbookRows(await file.arrayBuffer())
  } catch {
    return { ok: false, error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." }
  }
  if (rawRows.length === 0) return { ok: false, error: "El archivo no tiene filas de datos" }

  const [districts, churches, existingStats] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      select: { id: true, name: true },
    }),
    prisma.church.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      select: { id: true, name: true, districtId: true },
    }),
    prisma.statisticRecord.findMany({
      where: { organizationId: ctx.organizationId },
      select: { churchId: true, year: true, month: true, memberCount: true },
    }),
  ])

  const errors: ImportRowError[] = []
  const parsedRows: ParsedRow[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    const rowNum = i + 2 // header occupies row 1
    const districtName = (row["distrito"] ?? "").trim()
    const churchName = (row["iglesia"] ?? "").trim()
    const yearText = (row["ano"] ?? row["año"] ?? row["anio"] ?? "").trim()
    const monthText = (row["mes"] ?? "").trim()
    const membersText = (row["miembros"] ?? "").trim()
    const baptismsText = (row["bautismos"] ?? "").trim()

    if (!districtName || !churchName) {
      errors.push({ row: rowNum, message: "Distrito e Iglesia son obligatorios" })
      continue
    }

    const district = districts.find((d) => normalizeText(d.name) === normalizeText(districtName))
    if (!district) {
      errors.push({ row: rowNum, message: `Distrito no encontrado: "${districtName}"` })
      continue
    }

    const church = churches.find(
      (c) => normalizeText(c.name) === normalizeText(churchName) && c.districtId === district.id,
    )
    if (!church) {
      errors.push({
        row: rowNum,
        message: `Iglesia no encontrada en el distrito "${districtName}": "${churchName}"`,
      })
      continue
    }

    const year = Number(yearText)
    const month = Number(monthText)
    if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1) {
      errors.push({ row: rowNum, message: `Año inválido: "${yearText}"` })
      continue
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      errors.push({ row: rowNum, message: `Mes inválido: "${monthText}" (usar 1-12)` })
      continue
    }

    let baptisms = 0
    if (baptismsText) {
      baptisms = Number(baptismsText)
      if (!Number.isInteger(baptisms) || baptisms < 0) {
        errors.push({ row: rowNum, message: `Bautismos inválido: "${baptismsText}"` })
        continue
      }
    }
    if (membersText) {
      const members = Number(membersText)
      if (!Number.isInteger(members) || members < 0) {
        errors.push({ row: rowNum, message: `Miembros inválido: "${membersText}"` })
        continue
      }
    }

    parsedRows.push({ rowNum, churchId: church.id, year, month, membersText, baptisms })
  }

  // Seed the carry-forward baseline per church from the most recent existing record.
  const baselines = new Map<string, { key: number; value: number }>()
  for (const s of existingStats) {
    const key = sortKey(s.year, s.month ?? 0)
    const prev = baselines.get(s.churchId)
    if (!prev || key > prev.key) baselines.set(s.churchId, { key, value: s.memberCount })
  }

  const byChurch = new Map<string, ParsedRow[]>()
  for (const r of parsedRows) {
    const list = byChurch.get(r.churchId) ?? []
    list.push(r)
    byChurch.set(r.churchId, list)
  }

  let saved = 0
  for (const [churchId, churchRows] of byChurch) {
    churchRows.sort((a, b) => sortKey(a.year, a.month) - sortKey(b.year, b.month))
    const baseline = baselines.get(churchId)?.value ?? null
    const membersInput = churchRows.map((r) => (r.membersText ? Number(r.membersText) : null))
    const resolvedMembers = resolveMemberCarryForward(membersInput, baseline)

    for (let idx = 0; idx < churchRows.length; idx++) {
      const r = churchRows[idx]
      const memberCount = resolvedMembers[idx]
      if (memberCount == null) {
        errors.push({
          row: r.rowNum,
          message: "Falta indicar Miembros: no hay ningún dato previo de esta iglesia para arrastrar",
        })
        continue
      }

      const record = await prisma.statisticRecord.upsert({
        where: { churchId_year_month: { churchId, year: r.year, month: r.month } },
        create: {
          organizationId: ctx.organizationId,
          churchId,
          period: "MONTHLY",
          year: r.year,
          month: r.month,
          memberCount,
          baptismCount: r.baptisms,
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
        update: {
          memberCount,
          baptismCount: r.baptisms,
          updatedById: ctx.userId,
        },
      })

      await audit(ctx.organizationId, ctx.userId, "statistic.import", "statisticRecord", record.id, {
        row: r.rowNum,
        churchId,
        year: r.year,
        month: r.month,
        memberCount,
        baptismCount: r.baptisms,
      })

      saved++
    }
  }

  revalidatePath("/churches")
  revalidatePath("/districts")
  revalidatePath("/")

  return { ok: true, summary: { saved, errors } }
}
