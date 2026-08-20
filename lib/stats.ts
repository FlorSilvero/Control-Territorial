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

export type MembersTrend = "up" | "down" | "flat"

export type ChurchStats = {
  currentMembers: number
  baptismsThisYear: number
  baptismsTotal: number
  /** Member count snapshot from before this year started, or null if there's no prior data. */
  startOfYearMembers: number | null
  /** How currentMembers compares to startOfYearMembers; null when there's nothing to compare against. */
  membersTrend: MembersTrend | null
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

  const currentMembers = latest?.memberCount ?? 0
  const startOfYearMembers = computeStartOfYearMembers(rows)
  const membersTrend =
    startOfYearMembers === null
      ? null
      : currentMembers > startOfYearMembers
        ? "up"
        : currentMembers < startOfYearMembers
          ? "down"
          : "flat"

  return {
    currentMembers,
    baptismsThisYear,
    baptismsTotal,
    startOfYearMembers,
    membersTrend,
  }
}

/**
 * Member count as of the start of the current year: the closing snapshot
 * from the year before (its ANNUAL row, or whichever record is most recent
 * if that's missing). Falls back to the earliest record within the current
 * year itself when there's no data from before it, and to null when there's
 * no data at all to establish a baseline.
 */
export function computeStartOfYearMembers(rows: StatRow[]): number | null {
  const priorYearRows = rows.filter((r) => r.year < CURRENT_YEAR)
  if (priorYearRows.length > 0) {
    const latestPrior = priorYearRows.reduce((a, b) => (sortKey(b) > sortKey(a) ? b : a))
    return latestPrior.memberCount
  }

  const currentYearRows = rows.filter((r) => r.year === CURRENT_YEAR)
  if (currentYearRows.length > 0) {
    const earliestCurrent = currentYearRows.reduce((a, b) => (sortKey(b) < sortKey(a) ? b : a))
    return earliestCurrent.memberCount
  }

  return null
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
 * Same lookup as assignmentForDate, but a date before every known assignment
 * falls back to whichever tenure started earliest, instead of matching no
 * one. Used for attributing baptisms: statistics recorded for a date before
 * any assignment on record ever started can't belong to some earlier pastor
 * (there isn't one on record), so they belong to the earliest tenure rather
 * than vanishing from that pastor's totals while district/church totals
 * still count them.
 */
export function assignmentForDateOrEarliest(
  assignments: AssignmentWindow[],
  date: Date,
): AssignmentWindow | null {
  const direct = assignmentForDate(assignments, date)
  if (direct) return direct

  const earliest = assignments.reduce<AssignmentWindow | null>(
    (e, a) => (!e || a.startDate.getTime() < e.startDate.getTime() ? a : e),
    null,
  )
  if (earliest && date.getTime() < earliest.startDate.getTime()) return earliest
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

  // Earliest-known tenure for this district, used below to catch "pre-history"
  // rows: statistics recorded for a date before any assignment on record ever
  // started. Nobody else could have earned them, so rather than silently
  // dropping them (and making the pastor's total disappear while the
  // district/church totals still show them), they belong to whoever's tenure
  // started earliest.
  const earliest = windows.reduce<AssignmentWindow | null>(
    (e, w) => (!e || w.startDate.getTime() < e.startDate.getTime() ? w : e),
    null,
  )

  for (const row of rows) {
    if (row.baptismCount === 0) continue

    if (row.period === "MONTHLY" && row.month) {
      const a = assignmentForDateOrEarliest(windows, new Date(row.year, row.month - 1, 15))
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
    if (totalDays <= 0) {
      if (earliest && yearEnd <= earliest.startDate.getTime()) {
        add(earliest.id, row.baptismCount)
      }
      continue
    }

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
