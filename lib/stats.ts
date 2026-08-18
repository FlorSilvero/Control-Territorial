/**
 * Pure aggregation helpers over StatisticRecord rows.
 *
 * Core distinction:
 *  - memberCount is a STOCK: the "current" value is the most recent snapshot.
 *  - baptismCount is a FLOW: values are summed over a period.
 *
 * "Current year" baptisms and "total" baptisms are both derived here so the UI
 * never duplicates aggregation logic.
 */

export type StatRow = {
  period: "ANNUAL" | "MONTHLY"
  year: number
  month: number | null
  memberCount: number
  baptismCount: number
}

export type AssignmentWindow = {
  id: string
  pastorId: string
  districtId: string
  startDate: Date
  endDate: Date | null
  pastor?: { id: string; firstName: string; lastName: string }
}

export const CURRENT_YEAR = new Date().getFullYear()
export const CURRENT_MONTH = new Date().getMonth() + 1

/** Higher key = more recent. Monthly records outrank the annual of the same year. */
function sortKey(r: StatRow): number {
  return r.year * 13 + (r.month ?? 0)
}

export type ChurchStats = {
  currentMembers: number
  baptismsThisYear: number
  baptismsTotal: number
}

export function computeChurchStats(rows: StatRow[]): ChurchStats {
  let latest: StatRow | null = null
  let baptismsThisYear = 0
  let baptismsTotal = 0

  for (const r of rows) {
    if (!latest || sortKey(r) > sortKey(latest)) latest = r
    baptismsTotal += r.baptismCount
    if (r.year === CURRENT_YEAR) baptismsThisYear += r.baptismCount
  }

  return {
    currentMembers: latest?.memberCount ?? 0,
    baptismsThisYear,
    baptismsTotal,
  }
}

/** Representative date used to attribute a stat record to a pastor's tenure. */
export function representativeDate(row: StatRow): Date {
  if (row.period === "MONTHLY" && row.month) {
    return new Date(row.year, row.month - 1, 15)
  }
  // Annual: attribute to year-end (or "today" for the current, in-progress year).
  if (row.year === CURRENT_YEAR) return new Date()
  return new Date(row.year, 11, 31)
}

/** The assignment whose [startDate, endDate) window contains the given date. */
export function assignmentForDate(
  assignments: AssignmentWindow[],
  date: Date,
): AssignmentWindow | null {
  for (const a of assignments) {
    const startsOk = a.startDate.getTime() <= date.getTime()
    const endsOk = a.endDate == null || a.endDate.getTime() >= date.getTime()
    if (startsOk && endsOk) return a
  }
  return null
}

export function pastorLabel(
  p?: { firstName: string; lastName: string } | null,
): string {
  if (!p) return "Sin pastor"
  return `${p.firstName} ${p.lastName}`
}
