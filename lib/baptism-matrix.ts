/**
 * Pure translation between the "Bautismos <año>" planilla and StatisticRecord.
 *
 * The planilla is a matrix: one row per DISTRICT, one column per month, one
 * sheet per year. The database is church-grained, so a district's monthly
 * total is imputed to its head congregation — the one named after the district,
 * or its largest by membership. That is the same rule the historical
 * 2021-2026 load used (prisma/data/bautismos-mapeo.ts), which is what keeps a
 * re-import of the same planilla from disagreeing with what's already stored.
 *
 * Everything here is side-effect free so the whole mapping can be tested
 * without a database or a spreadsheet.
 */
import type { SheetRow } from "@/lib/excel"
import { pick } from "@/lib/excel"
import { MONTH_COLUMNS, BAPTISM_YEAR_COLUMN, aliasesOf } from "@/lib/excel-schemas"
import { normalizeText } from "@/lib/utils"

/** Month column aliases by month number - 1, in sheet order. */
const MONTH_ALIASES = MONTH_COLUMNS.map((c) => aliasesOf(c))
const DISTRICT_ALIASES = ["Distrito", "Distrito pastoral"] as const
const RESPONSABLE_ALIASES = ["Responsable", "Pastor", "Pastor responsable"] as const
const YEAR_ALIASES = aliasesOf(BAPTISM_YEAR_COLUMN)

/** Dashes Excel and the original planilla use for "no baptisms this month". */
const BLANK_CELL = /^[-–—\s]*$/

/**
 * The planilla closes with a "Total de la Entidad" line. It's a summary, not a
 * district, so it is skipped instead of failing to resolve — and exports write
 * it back out for the sheet to look like the original.
 */
const TOTAL_ROW = /^total\b/

/** A month cell: the number written in it, or null when it was left blank. */
export type MonthCells = (number | null)[]

export type MatrixRow = {
  sheetName: string
  rowNumber: number
  districtName: string
  responsable: string
  year: number
  /** Always length 12; index 0 is January. */
  months: MonthCells
}

export type MatrixIssue = { sheet: string; row: number; message: string }

export type Period = { year: number; month: number }

/**
 * Pulls a year out of a sheet name like "Bautismos 2025" or "2025". Returns
 * null when the name carries no plausible year, so the caller can fall back to
 * an "Año" column or the year picked in the dialog.
 */
export function yearFromSheetName(name: string): number | null {
  const match = name.match(/(19|20)\d{2}/)
  return match ? Number(match[0]) : null
}

/**
 * Reads one cell of a month column. A blank or dashed cell is `null` ("nothing
 * written"), not zero — deciding what a blank means is expandPeriods' job.
 *
 * Negative values are accepted on purpose: the planilla uses them to correct a
 * baptism booked to the wrong congregation in an earlier month.
 */
export function parseCount(text: string): { ok: true; value: number | null } | { ok: false } {
  if (!text || BLANK_CELL.test(text)) return { ok: true, value: null }
  const cleaned = text.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "")
  const value = Number(cleaned)
  if (!Number.isInteger(value)) return { ok: false }
  return { ok: true, value }
}

/**
 * Turns every worksheet of an uploaded workbook into matrix rows.
 *
 * The year comes from the sheet name ("Bautismos 2025"), from an optional
 * "Año" column, or from `fallbackYear` — in that order of specificity, most
 * specific last, so a row can always override its sheet.
 */
export function parseMatrixSheets(
  sheets: { name: string; rows: SheetRow[] }[],
  opts: { fallbackYear: number | null; maxYear: number },
): { rows: MatrixRow[]; issues: MatrixIssue[] } {
  const rows: MatrixRow[] = []
  const issues: MatrixIssue[] = []

  for (const sheet of sheets) {
    const sheetYear = yearFromSheetName(sheet.name) ?? opts.fallbackYear

    for (const { rowNumber, values } of sheet.rows) {
      const districtName = pick(values, DISTRICT_ALIASES)
      if (!districtName) continue // a spacer or a stray note, not a district
      if (TOTAL_ROW.test(normalizeText(districtName))) continue

      const yearText = pick(values, YEAR_ALIASES)
      const year = yearText ? Number(yearText) : sheetYear
      if (year == null) {
        issues.push({
          sheet: sheet.name,
          row: rowNumber,
          message: `No se pudo determinar el año: la hoja "${sheet.name}" no lo nombra y la fila no trae columna Año`,
        })
        continue
      }
      if (!Number.isInteger(year) || year < 1900 || year > opts.maxYear) {
        issues.push({ sheet: sheet.name, row: rowNumber, message: `Año inválido: "${yearText || sheet.name}"` })
        continue
      }

      const months: MonthCells = []
      let invalid: string | null = null
      for (let i = 0; i < 12; i++) {
        const raw = pick(values, MONTH_ALIASES[i])
        const parsed = parseCount(raw)
        if (!parsed.ok) {
          invalid = `${MONTH_COLUMNS[i].label} tiene un valor que no es un número entero: "${raw}"`
          break
        }
        months.push(parsed.value)
      }
      if (invalid) {
        issues.push({ sheet: sheet.name, row: rowNumber, message: invalid })
        continue
      }

      rows.push({
        sheetName: sheet.name,
        rowNumber,
        districtName,
        responsable: pick(values, RESPONSABLE_ALIASES),
        year,
        months,
      })
    }
  }

  return { rows, issues }
}

export type PlannedPeriod = {
  sheet: string
  rowNumber: number
  districtName: string
  year: number
  month: number
  baptisms: number
}

/**
 * Flattens matrix rows into one (district, year, month, baptisms) per cell.
 *
 * A blank cell means zero: within a year the planilla is complete, so a month
 * nobody wrote in is a month with no baptisms, and importing it as zero is what
 * lets the sheet correct a number that was loaded by mistake.
 *
 * The exception is a period that hasn't happened yet. The current year's sheet
 * carries empty columns for the months still to come, and writing zeros for
 * them would invent records for the future, so blanks there are skipped. An
 * explicit number is always honoured.
 */
export function expandPeriods(
  rows: MatrixRow[],
  now: Period,
): { periods: PlannedPeriod[]; issues: MatrixIssue[] } {
  const periods: PlannedPeriod[] = []
  const issues: MatrixIssue[] = []
  /** `${year}|${districtKey}` -> the row that already claimed it. */
  const claimed = new Map<string, MatrixRow>()

  for (const row of rows) {
    const key = `${row.year}|${normalizeText(row.districtName)}`
    const previous = claimed.get(key)
    if (previous) {
      issues.push({
        sheet: row.sheetName,
        row: row.rowNumber,
        message: `"${row.districtName}" ${row.year} ya aparece en la fila ${previous.rowNumber}${
          previous.sheetName === row.sheetName ? "" : ` de la hoja "${previous.sheetName}"`
        }`,
      })
      continue
    }
    claimed.set(key, row)

    row.months.forEach((value, index) => {
      const month = index + 1
      if (value == null && isFuture({ year: row.year, month }, now)) return
      periods.push({
        sheet: row.sheetName,
        rowNumber: row.rowNumber,
        districtName: row.districtName,
        year: row.year,
        month,
        baptisms: value ?? 0,
      })
    })
  }

  return { periods, issues }
}

/** True when (year, month) is later than the month we're currently in. */
export function isFuture(period: Period, now: Period): boolean {
  return period.year * 12 + period.month > now.year * 12 + now.month
}

export type ChurchRef = { id: string; name: string; members: number }

/**
 * The congregation that carries a district's planilla numbers: the one named
 * after the district when there is one, otherwise its largest by membership
 * (ties broken by name so the choice is stable between runs).
 *
 * Returns null for a district with no congregations at all — there is nowhere
 * to put the number, and the caller reports that as a row error.
 */
export function resolveHeadChurch(districtName: string, churches: ChurchRef[]): ChurchRef | null {
  if (churches.length === 0) return null

  const key = normalizeText(districtName)
  const sameName = churches.find((c) => normalizeText(c.name) === key)
  if (sameName) return sameName

  return churches.reduce((best, c) =>
    c.members > best.members || (c.members === best.members && c.name < best.name) ? c : best,
  )
}

export type PeriodChange = {
  districtName: string
  churchName: string
  year: number
  month: number
  /** What the app has today; null when there's no record for this period yet. */
  before: number | null
  after: number
}

/** Only the periods whose baptism count the file would actually change. */
export function diffPeriods(
  resolved: (PlannedPeriod & { churchId: string; churchName: string })[],
  storedByKey: Map<string, number>,
): PeriodChange[] {
  const changes: PeriodChange[] = []
  for (const p of resolved) {
    const before = storedByKey.get(`${p.churchId}|${p.year}|${p.month}`) ?? null
    if (before === p.baptisms) continue
    changes.push({
      districtName: p.districtName,
      churchName: p.churchName,
      year: p.year,
      month: p.month,
      before,
      after: p.baptisms,
    })
  }
  return changes
}
