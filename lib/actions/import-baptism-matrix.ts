"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { normalizeText } from "@/lib/utils"
import { readAllSheetRows, ExcelReadError, type NamedSheet } from "@/lib/excel"
import {
  parseMatrixSheets,
  expandPeriods,
  resolveHeadChurch,
  diffPeriods,
  type MatrixIssue,
  type PeriodChange,
  type PlannedPeriod,
  type ChurchRef,
} from "@/lib/baptism-matrix"
import { computeChurchStats, membersAsOf, type StatRow } from "@/lib/stats"
import { auditMany, type AuditEntry } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }

export type BaptismMatrixPreview = {
  /** Years the file touches, ascending. */
  years: number[]
  /** Only the periods whose number would change, capped at MAX_REPORTED_CHANGES. */
  changes: PeriodChange[]
  changeCount: number
  /** Periods the file confirms but doesn't change. */
  unchangedCount: number
  /** Of `changeCount`, how many periods have no record in the app yet. */
  createdCount: number
  districtNames: string[]
  errors: ImportRowError[]
  errorCount: number
}

export type PreviewBaptismMatrixResult =
  | { ok: true; preview: BaptismMatrixPreview }
  | { ok: false; error: string }

export type ImportBaptismMatrixSummary = {
  saved: number
  unchangedCount: number
  errors: ImportRowError[]
  errorCount: number
}

export type ImportBaptismMatrixResult =
  | { ok: true; summary: ImportBaptismMatrixSummary }
  | { ok: false; error: string }

/** Enough for the user to see the pattern without rendering thousands of rows. */
const MAX_REPORTED_ERRORS = 100
/** The preview is a review screen, not a report: it lists, it doesn't dump. */
const MAX_REPORTED_CHANGES = 300
/** Rows per write transaction: bounds both lock time and transaction timeout. */
const CHUNK_SIZE = 200

type ResolvedPeriod = PlannedPeriod & { churchId: string; churchName: string }

type Plan = {
  years: number[]
  districtNames: string[]
  resolved: ResolvedPeriod[]
  /** The subset of `resolved` the file would actually change, same order as `changes`. */
  toWrite: ResolvedPeriod[]
  changes: PeriodChange[]
  /** Church id -> its full statistic history, for the member carry-forward. */
  historyByChurch: Map<string, StatRow[]>
  errors: ImportRowError[]
  errorCount: number
}

/**
 * Reads the "Bautismos" planilla and works out exactly what it would change,
 * without writing anything. Shared by the preview and the import so the numbers
 * the user approves are the numbers that get written.
 */
async function buildPlan(
  formData: FormData,
  organizationId: string,
): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  const fallbackYearText = String(formData.get("year") ?? "")
  const fallbackYear = fallbackYearText ? Number(fallbackYearText) : null
  if (fallbackYear != null && !Number.isInteger(fallbackYear)) {
    return { ok: false, error: `Año inválido: "${fallbackYearText}"` }
  }

  let sheets: NamedSheet[]
  try {
    sheets = await readAllSheetRows(await file.arrayBuffer())
  } catch (err) {
    if (err instanceof ExcelReadError) return { ok: false, error: err.message }
    return { ok: false, error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." }
  }

  const now = new Date()
  const nowPeriod = { year: now.getFullYear(), month: now.getMonth() + 1 }

  const parsed = parseMatrixSheets(sheets, {
    fallbackYear,
    maxYear: nowPeriod.year + 1,
  })
  if (parsed.rows.length === 0 && parsed.issues.length === 0) {
    return {
      ok: false,
      error:
        "No se encontró ninguna fila con columna Distrito. Revisá que la planilla tenga los encabezados Distrito y Ene…Dic.",
    }
  }

  const expanded = expandPeriods(parsed.rows, nowPeriod)

  const errors: ImportRowError[] = []
  let errorCount = 0
  const multiSheet = sheets.length > 1
  const fail = (issue: MatrixIssue) => {
    errorCount++
    if (errors.length >= MAX_REPORTED_ERRORS) return
    const message = multiSheet ? `[${issue.sheet}] ${issue.message}` : issue.message
    errors.push({ row: issue.row, message })
  }
  for (const issue of [...parsed.issues, ...expanded.issues]) fail(issue)

  // The whole territorial structure in one query: the head-church rule needs
  // every congregation's membership, and the diff needs their history anyway.
  const districts = await prisma.district.findMany({
    where: { organizationId, archivedAt: null },
    include: {
      churches: {
        where: { archivedAt: null },
        include: { statistics: true },
        orderBy: { name: "asc" },
      },
    },
  })

  const historyByChurch = new Map<string, StatRow[]>()
  const headByDistrictKey = new Map<string, ChurchRef | null>()
  for (const d of districts) {
    const refs: ChurchRef[] = d.churches.map((c) => {
      const stats = c.statistics as StatRow[]
      historyByChurch.set(c.id, stats)
      return { id: c.id, name: c.name, members: computeChurchStats(stats).currentMembers }
    })
    headByDistrictKey.set(normalizeText(d.name), resolveHeadChurch(d.name, refs))
  }

  const resolved: ResolvedPeriod[] = []
  /** Districts already reported as unresolvable, so one bad name is one error. */
  const reportedDistricts = new Set<string>()
  for (const period of expanded.periods) {
    const key = normalizeText(period.districtName)
    if (!headByDistrictKey.has(key)) {
      if (!reportedDistricts.has(key)) {
        reportedDistricts.add(key)
        fail({
          sheet: period.sheet,
          row: period.rowNumber,
          message: `Distrito no encontrado: "${period.districtName}"`,
        })
      }
      continue
    }
    const head = headByDistrictKey.get(key) ?? null
    if (!head) {
      if (!reportedDistricts.has(key)) {
        reportedDistricts.add(key)
        fail({
          sheet: period.sheet,
          row: period.rowNumber,
          message: `El distrito "${period.districtName}" no tiene ninguna congregación donde registrar sus bautismos`,
        })
      }
      continue
    }
    resolved.push({ ...period, churchId: head.id, churchName: head.name })
  }

  const storedByKey = new Map<string, number>()
  for (const [churchId, stats] of historyByChurch) {
    for (const s of stats) {
      if (s.period !== "MONTHLY" || s.month == null) continue
      storedByKey.set(`${churchId}|${s.year}|${s.month}`, s.baptismCount)
    }
  }

  const changes = diffPeriods(resolved, storedByKey)
  const toWrite = resolved.filter(
    (p) => (storedByKey.get(`${p.churchId}|${p.year}|${p.month}`) ?? null) !== p.baptisms,
  )

  return {
    ok: true,
    plan: {
      years: [...new Set(resolved.map((p) => p.year))].sort((a, b) => a - b),
      districtNames: [...new Set(resolved.map((p) => p.districtName))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
      resolved,
      toWrite,
      changes,
      historyByChurch,
      errors,
      errorCount,
    },
  }
}

/**
 * Dry run of the planilla import: what would change, and what the file gets
 * wrong. Nothing is written, so the user can fix the sheet and try again.
 */
export async function previewBaptismMatrix(
  formData: FormData,
): Promise<PreviewBaptismMatrixResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const planned = await buildPlan(formData, ctx.organizationId)
  if (!planned.ok) return planned
  const { plan } = planned

  return {
    ok: true,
    preview: {
      years: plan.years,
      changes: plan.changes.slice(0, MAX_REPORTED_CHANGES),
      changeCount: plan.changes.length,
      unchangedCount: plan.resolved.length - plan.changes.length,
      createdCount: plan.changes.filter((c) => c.before === null).length,
      districtNames: plan.districtNames,
      errors: plan.errors,
      errorCount: plan.errorCount,
    },
  }
}

/**
 * Writes the planilla. Only the periods whose baptism count actually changes
 * are touched, so re-importing an unedited file is a no-op and the audit trail
 * stays a record of real edits.
 *
 * memberCount is never overwritten: on a period the app already knows it is
 * left exactly as it was, and on a new one it carries forward that church's
 * last known snapshot, so loading baptisms can't blank out a membership figure.
 */
export async function importBaptismMatrix(
  formData: FormData,
): Promise<ImportBaptismMatrixResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const planned = await buildPlan(formData, ctx.organizationId)
  if (!planned.ok) return planned
  const { plan } = planned

  const errors = [...plan.errors]
  let errorCount = plan.errorCount
  const fail = (row: number, message: string) => {
    errorCount++
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message })
  }

  const writes = plan.toWrite

  let saved = 0
  for (let offset = 0; offset < writes.length; offset += CHUNK_SIZE) {
    const chunk = writes.slice(offset, offset + CHUNK_SIZE)
    try {
      await prisma.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = []
          for (const p of chunk) {
            const history = plan.historyByChurch.get(p.churchId) ?? []
            const memberCount = membersAsOf(history, p.year, p.month) ?? 0
            const record = await tx.statisticRecord.upsert({
              where: {
                churchId_year_month: { churchId: p.churchId, year: p.year, month: p.month },
              },
              create: {
                organizationId: ctx.organizationId,
                churchId: p.churchId,
                period: "MONTHLY",
                year: p.year,
                month: p.month,
                memberCount,
                baptismCount: p.baptisms,
                createdById: ctx.userId,
                updatedById: ctx.userId,
              },
              update: { baptismCount: p.baptisms, updatedById: ctx.userId },
              select: { id: true },
            })
            entries.push({
              action: "statistic.import",
              entityType: "statisticRecord",
              entityId: record.id,
              metadata: {
                source: "planilla-bautismos",
                sheet: p.sheet,
                row: p.rowNumber,
                districtName: p.districtName,
                churchId: p.churchId,
                year: p.year,
                month: p.month,
                baptismCount: p.baptisms,
              },
            })
          }
          await auditMany(tx, ctx.organizationId, ctx.userId, entries)
        },
        { timeout: 60_000, maxWait: 15_000 },
      )
      saved += chunk.length
    } catch {
      for (const p of chunk) fail(p.rowNumber, "No se pudo guardar esta fila")
    }
  }

  revalidatePath("/churches")
  revalidatePath("/districts")
  revalidatePath("/")

  return {
    ok: true,
    summary: {
      saved,
      unchangedCount: plan.resolved.length - plan.changes.length,
      errors,
      errorCount,
    },
  }
}
