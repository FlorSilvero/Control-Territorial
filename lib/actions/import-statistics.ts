"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { normalizeText } from "@/lib/utils"
import { readWorkbookRows, pick, ExcelReadError, type SheetRow } from "@/lib/excel"
import { STATISTIC_COLUMNS, aliasesOf } from "@/lib/excel-schemas"
import { resolveMemberCarryForward } from "@/lib/stats"
import { auditMany, type AuditEntry } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }
export type ImportStatisticsSummary = {
  saved: number
  /** Capped at MAX_REPORTED_ERRORS; `errorCount` is the real total. */
  errors: ImportRowError[]
  errorCount: number
}
export type ImportStatisticsResult =
  | { ok: true; summary: ImportStatisticsSummary }
  | { ok: false; error: string }

const CURRENT_YEAR = new Date().getFullYear()
/** Enough for the user to see the pattern without rendering thousands of rows. */
const MAX_REPORTED_ERRORS = 100
/** Rows per write transaction: bounds both lock time and transaction timeout. */
const CHUNK_SIZE = 200

const COL = Object.fromEntries(STATISTIC_COLUMNS.map((c) => [c.label, aliasesOf(c)])) as Record<
  (typeof STATISTIC_COLUMNS)[number]["label"],
  readonly string[]
>

type ParsedRow = {
  rowNum: number
  churchId: string
  year: number
  month: number
  membersText: string
  baptisms: number
}

type WriteRow = ParsedRow & { memberCount: number }

/** Higher key = more recent. Mirrors sortKey() in lib/stats.ts. */
function sortKey(year: number, month: number): number {
  return year * 13 + month
}

/**
 * Bulk-loads monthly church statistics from an .xlsx file (column layout:
 * STATISTIC_COLUMNS). memberCount is a stock: a blank "Miembros" cell carries
 * forward the most recent known value for that church *as of that month* —
 * from the database or from an earlier row of the same import, whichever is
 * closer — instead of being treated as zero. baptismCount is a flow: it's the
 * period's raw value, not summed onto whatever was already stored.
 *
 * The file is fully validated before anything is written, so an unresolvable
 * row is reported without aborting the file; the surviving rows are then
 * written in chunked transactions instead of one round trip per row.
 */
export async function importDistrictStatistics(formData: FormData): Promise<ImportStatisticsResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  let rawRows: SheetRow[]
  try {
    rawRows = await readWorkbookRows(await file.arrayBuffer())
  } catch (err) {
    if (err instanceof ExcelReadError) return { ok: false, error: err.message }
    return { ok: false, error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." }
  }
  if (rawRows.length === 0) return { ok: false, error: "El archivo no tiene filas de datos" }

  const [districts, churches] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      select: { id: true, name: true },
    }),
    prisma.church.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      select: { id: true, name: true, districtId: true },
    }),
  ])

  // Normalized-key indexes: the previous linear `find` per row made the import
  // quadratic in the size of the org.
  const districtsByName = new Map(districts.map((d) => [normalizeText(d.name), d]))
  const churchesByKey = new Map<string, { id: string }>()
  for (const c of churches) {
    const key = `${c.districtId}|${normalizeText(c.name)}`
    if (!churchesByKey.has(key)) churchesByKey.set(key, c)
  }

  const errors: ImportRowError[] = []
  let errorCount = 0
  const fail = (row: number, message: string) => {
    errorCount++
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message })
  }

  const parsedRows: ParsedRow[] = []
  const seenPeriods = new Map<string, number>()

  for (const { rowNumber, values } of rawRows) {
    const districtName = pick(values, COL.Distrito)
    const churchName = pick(values, COL.Iglesia)
    const yearText = pick(values, COL["Año"])
    const monthText = pick(values, COL.Mes)
    const membersText = pick(values, COL.Miembros)
    const baptismsText = pick(values, COL.Bautismos)

    if (!districtName || !churchName) {
      fail(rowNumber, "Distrito e Iglesia son obligatorios")
      continue
    }

    const district = districtsByName.get(normalizeText(districtName))
    if (!district) {
      fail(rowNumber, `Distrito no encontrado: "${districtName}"`)
      continue
    }

    const church = churchesByKey.get(`${district.id}|${normalizeText(churchName)}`)
    if (!church) {
      fail(rowNumber, `Iglesia no encontrada en el distrito "${districtName}": "${churchName}"`)
      continue
    }

    const year = Number(yearText)
    const month = Number(monthText)
    if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1) {
      fail(rowNumber, `Año inválido: "${yearText}"`)
      continue
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      fail(rowNumber, `Mes inválido: "${monthText}" (usar 1-12)`)
      continue
    }

    const periodKey = `${church.id}|${year}|${month}`
    const duplicateOf = seenPeriods.get(periodKey)
    if (duplicateOf != null) {
      fail(
        rowNumber,
        `"${churchName}" ${month}/${year} ya aparece en la fila ${duplicateOf} del archivo`,
      )
      continue
    }

    let baptisms = 0
    if (baptismsText) {
      baptisms = Number(baptismsText)
      if (!Number.isInteger(baptisms) || baptisms < 0) {
        fail(rowNumber, `Bautismos inválido: "${baptismsText}"`)
        continue
      }
    }
    if (membersText) {
      const members = Number(membersText)
      if (!Number.isInteger(members) || members < 0) {
        fail(rowNumber, `Miembros inválido: "${membersText}"`)
        continue
      }
    }

    seenPeriods.set(periodKey, rowNumber)
    parsedRows.push({ rowNum: rowNumber, churchId: church.id, year, month, membersText, baptisms })
  }

  const byChurch = new Map<string, ParsedRow[]>()
  for (const r of parsedRows) {
    const list = byChurch.get(r.churchId) ?? []
    list.push(r)
    byChurch.set(r.churchId, list)
  }

  // Only the churches the file actually touches, instead of the whole org.
  const known = await prisma.statisticRecord.findMany({
    where: { organizationId: ctx.organizationId, churchId: { in: [...byChurch.keys()] } },
    select: { churchId: true, year: true, month: true, memberCount: true },
  })
  const knownByChurch = new Map<string, { key: number; value: number }[]>()
  for (const s of known) {
    const list = knownByChurch.get(s.churchId) ?? []
    list.push({ key: sortKey(s.year, s.month ?? 0), value: s.memberCount })
    knownByChurch.set(s.churchId, list)
  }
  for (const list of knownByChurch.values()) list.sort((a, b) => a.key - b.key)

  const writeRows: WriteRow[] = []
  for (const [churchId, churchRows] of byChurch) {
    churchRows.sort((a, b) => sortKey(a.year, a.month) - sortKey(b.year, b.month))
    const stored = knownByChurch.get(churchId) ?? []

    /** Most recent stored value strictly before `key`, or null. */
    const storedBefore = (key: number): { key: number; value: number } | null => {
      let found: { key: number; value: number } | null = null
      for (const s of stored) {
        if (s.key >= key) break
        found = s
      }
      return found
    }

    const firstKey = sortKey(churchRows[0].year, churchRows[0].month)
    const baseline = storedBefore(firstKey)?.value ?? null
    // A stored record that sits between two imported rows is more recent than
    // the earlier row, so it — not that row — is what a blank cell carries.
    const membersInput = churchRows.map((r, idx) => {
      if (r.membersText) return Number(r.membersText)
      if (idx === 0) return null // covered by `baseline`
      const prevKey = sortKey(churchRows[idx - 1].year, churchRows[idx - 1].month)
      const between = storedBefore(sortKey(r.year, r.month))
      return between && between.key > prevKey ? between.value : null
    })
    const resolvedMembers = resolveMemberCarryForward(membersInput, baseline)

    for (let idx = 0; idx < churchRows.length; idx++) {
      const memberCount = resolvedMembers[idx]
      if (memberCount == null) {
        fail(
          churchRows[idx].rowNum,
          "Falta indicar Miembros: no hay ningún dato previo de esta iglesia para arrastrar",
        )
        continue
      }
      writeRows.push({ ...churchRows[idx], memberCount })
    }
  }

  let saved = 0
  for (let offset = 0; offset < writeRows.length; offset += CHUNK_SIZE) {
    const chunk = writeRows.slice(offset, offset + CHUNK_SIZE)
    try {
      await prisma.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = []
          for (const r of chunk) {
            const record = await tx.statisticRecord.upsert({
              where: { churchId_year_month: { churchId: r.churchId, year: r.year, month: r.month } },
              create: {
                organizationId: ctx.organizationId,
                churchId: r.churchId,
                period: "MONTHLY",
                year: r.year,
                month: r.month,
                memberCount: r.memberCount,
                baptismCount: r.baptisms,
                createdById: ctx.userId,
                updatedById: ctx.userId,
              },
              update: {
                memberCount: r.memberCount,
                baptismCount: r.baptisms,
                updatedById: ctx.userId,
              },
              select: { id: true },
            })
            entries.push({
              action: "statistic.import",
              entityType: "statisticRecord",
              entityId: record.id,
              metadata: {
                row: r.rowNum,
                churchId: r.churchId,
                year: r.year,
                month: r.month,
                memberCount: r.memberCount,
                baptismCount: r.baptisms,
              },
            })
          }
          await auditMany(tx, ctx.organizationId, ctx.userId, entries)
        },
        { timeout: 60_000, maxWait: 15_000 },
      )
      saved += chunk.length
    } catch {
      for (const r of chunk) fail(r.rowNum, "No se pudo guardar esta fila")
    }
  }

  revalidatePath("/churches")
  revalidatePath("/districts")
  revalidatePath("/")

  return { ok: true, summary: { saved, errors, errorCount } }
}
