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

/**
 * Attributes every row's baptismCount to the assignment window(s) that were
 * active while it happened, returning a Map<assignmentId, baptisms>.
 *
 * MONTHLY rows pin down an exact month, so they go entirely to whichever
 * assignment covers that month (assignments for a district never overlap).
 *
 * ANNUAL rows ("Cierre de año") only say a whole calendar year's total — they
 * don't say when in the year the baptisms happened. Picking a single
 * representative date (e.g. Dec 31) to look up "the" assignment breaks as
 * soon as a district changed pastors mid-year: the record falls outside the
 * assignment that actually covered most of the year and reports 0 for it,
 * even though the church/district totals (which just sum every row) still
 * show the full count. Splitting proportionally by the number of days each
 * assignment was active within that year keeps every view consistent: the
 * per-assignment amounts always add back up to the row's original total.
 */
export function attributeBaptisms(
  rows: StatRow[],
  windows: AssignmentWindow[],
): Map<string, number> {
  const result = new Map<string, number>()
  const add = (id: string, amount: number) => {
    if (amount === 0) return
    result.set(id, (result.get(id) ?? 0) + amount)
  }

  for (const row of rows) {
    if (row.baptismCount === 0) continue

    if (row.period === "MONTHLY" && row.month) {
      const a = assignmentForDate(windows, new Date(row.year, row.month - 1, 15))
      if (a) add(a.id, row.baptismCount)
      continue
    }

    // ANNUAL: prorate across every assignment overlapping the year, by days.
    const yearStart = new Date(row.year, 0, 1).getTime()
    const yearEnd = (row.year === CURRENT_YEAR ? new Date() : new Date(row.year, 11, 31)).getTime()

    const overlaps = windows
      .map((w) => {
        const start = Math.max(w.startDate.getTime(), yearStart)
        const end = Math.min(w.endDate ? w.endDate.getTime() : yearEnd, yearEnd)
        return { id: w.id, days: end - start }
      })
      .filter((o) => o.days > 0)

    const totalDays = overlaps.reduce((acc, o) => acc + o.days, 0)
    if (totalDays <= 0) continue

    let distributed = 0
    overlaps.forEach((o, idx) => {
      const isLast = idx === overlaps.length - 1
      const amount = isLast
        ? row.baptismCount - distributed
        : Math.round((o.days / totalDays) * row.baptismCount)
      distributed += amount
      add(o.id, amount)
    })
  }

  return result
}

export function pastorLabel(
  p?: { firstName: string; lastName: string } | null,
): string {
  if (!p) return "Sin pastor"
  return `${p.firstName} ${p.lastName}`
}
