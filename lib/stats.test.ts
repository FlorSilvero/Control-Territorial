import { describe, it, expect } from "vitest"
import {
  computeChurchStats,
  representativeDate,
  assignmentForDate,
  assignmentForDateOrEarliest,
  attributeBaptisms,
  resolveMemberCarryForward,
  membersAsOf,
  CURRENT_YEAR,
  type StatRow,
  type AssignmentWindow,
} from "@/lib/stats"

function monthly(year: number, month: number, baptismCount: number, memberCount = 0): StatRow {
  return { period: "MONTHLY", year, month, memberCount, baptismCount }
}

function annual(year: number, baptismCount: number, memberCount = 0): StatRow {
  return { period: "ANNUAL", year, month: null, memberCount, baptismCount }
}

function window(
  id: string,
  startDate: Date,
  endDate: Date | null,
  overrides: Partial<AssignmentWindow> = {},
): AssignmentWindow {
  return { id, pastorId: id, districtId: "d1", startDate, endDate, ...overrides }
}

// ---------------------------------------------------------------------------
// computeChurchStats: memberCount is a stock, baptismCount is a flow.
// ---------------------------------------------------------------------------
describe("computeChurchStats", () => {
  it("sums baptisms across all rows but takes members from the most recent snapshot", () => {
    const rows: StatRow[] = [
      monthly(2024, 1, 5, 100),
      monthly(2024, 2, 3, 108),
      annual(2023, 12, 90),
    ]
    const stats = computeChurchStats(rows)
    expect(stats.baptismsTotal).toBe(20) // 5 + 3 + 12
    expect(stats.currentMembers).toBe(108) // latest by (year, month)
  })

  it("counts only current-year rows toward baptismsThisYear", () => {
    const rows: StatRow[] = [monthly(CURRENT_YEAR, 1, 4), annual(CURRENT_YEAR - 1, 50)]
    const stats = computeChurchStats(rows)
    expect(stats.baptismsThisYear).toBe(4)
    expect(stats.baptismsTotal).toBe(54)
  })

  it("returns zeros for an empty history", () => {
    const stats = computeChurchStats([])
    expect(stats).toEqual({
      currentMembers: 0,
      baptismsThisYear: 0,
      baptismsTotal: 0,
      startOfYearMembers: null,
      membersTrend: null,
    })
  })

  it("takes startOfYearMembers from the prior year's most recent snapshot", () => {
    const rows: StatRow[] = [
      annual(CURRENT_YEAR - 1, 12, 90),
      monthly(CURRENT_YEAR, 1, 4, 95),
      monthly(CURRENT_YEAR, 2, 3, 108),
    ]
    const stats = computeChurchStats(rows)
    expect(stats.startOfYearMembers).toBe(90)
    expect(stats.membersTrend).toBe("up")
  })

  it("falls back to the earliest current-year row when there's no prior-year data", () => {
    const rows: StatRow[] = [monthly(CURRENT_YEAR, 1, 4, 100), monthly(CURRENT_YEAR, 3, 2, 90)]
    const stats = computeChurchStats(rows)
    expect(stats.startOfYearMembers).toBe(100)
    expect(stats.membersTrend).toBe("down")
  })

  it("reports a flat trend when membership hasn't changed since the start of the year", () => {
    const rows: StatRow[] = [annual(CURRENT_YEAR - 1, 0, 90), monthly(CURRENT_YEAR, 1, 0, 90)]
    const stats = computeChurchStats(rows)
    expect(stats.membersTrend).toBe("flat")
  })

  it("has no trend when there's no data at all to establish a baseline", () => {
    const stats = computeChurchStats([])
    expect(stats.startOfYearMembers).toBeNull()
    expect(stats.membersTrend).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// representativeDate / assignmentForDate: the point-in-time primitives.
// ---------------------------------------------------------------------------
describe("representativeDate", () => {
  it("pins a monthly row to the 15th of that month", () => {
    expect(representativeDate(monthly(2024, 3, 1))).toEqual(new Date(2024, 2, 15))
  })

  it("pins a past year's annual row to Dec 31 of that year", () => {
    expect(representativeDate(annual(2023, 1))).toEqual(new Date(2023, 11, 31))
  })
})

describe("assignmentForDate", () => {
  const windows = [
    window("a1", new Date(2023, 0, 1), new Date(2023, 5, 30)),
    window("a2", new Date(2023, 6, 1), null),
  ]

  it("finds the assignment whose window contains the date", () => {
    expect(assignmentForDate(windows, new Date(2023, 2, 1))?.id).toBe("a1")
    expect(assignmentForDate(windows, new Date(2024, 0, 1))?.id).toBe("a2")
  })

  it("returns null when no assignment covers the date", () => {
    expect(assignmentForDate(windows, new Date(2020, 0, 1))).toBeNull()
  })
})

describe("assignmentForDateOrEarliest", () => {
  const windows = [
    window("a1", new Date(2023, 0, 1), new Date(2023, 5, 30)),
    window("a2", new Date(2023, 6, 1), null),
  ]

  it("behaves like assignmentForDate when a window covers the date", () => {
    expect(assignmentForDateOrEarliest(windows, new Date(2023, 2, 1))?.id).toBe("a1")
  })

  it("falls back to the earliest tenure for a date before every window", () => {
    expect(assignmentForDateOrEarliest(windows, new Date(2020, 0, 1))?.id).toBe("a1")
  })

  it("still returns null with no assignments at all", () => {
    expect(assignmentForDateOrEarliest([], new Date(2020, 0, 1))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// attributeBaptisms: this is where the reported bug lived.
// ---------------------------------------------------------------------------
describe("attributeBaptisms", () => {
  it("gives a single full-year assignment all of that year's baptisms", () => {
    const windows = [window("a1", new Date(2023, 0, 1), null)]
    const rows = [annual(2023, 22)]
    const result = attributeBaptisms(rows, windows)
    expect(result.get("a1")).toBe(22)
  })

  it("attributes monthly rows to the exact assignment covering that month", () => {
    const windows = [
      window("a1", new Date(2024, 0, 1), new Date(2024, 5, 30)),
      window("a2", new Date(2024, 6, 1), null),
    ]
    const rows = [monthly(2024, 3, 5), monthly(2024, 9, 7)]
    const result = attributeBaptisms(rows, windows)
    expect(result.get("a1")).toBe(5)
    expect(result.get("a2")).toBe(7)
  })

  // Regression test for the exact issue reported: a pastor's tenure showed
  // 22 baptisms in the church/district totals but 0 in their own
  // "Historial de Asignaciones y Gestiones" entry. That happened whenever a
  // whole-year ("ANNUAL") statistic was recorded for a year in which the
  // district changed pastors mid-year: the old code checked a single
  // representative date (Dec 31) against ONE assignment's window, so it
  // landed outside the assignment that had actually ended earlier that year.
  it("does not silently drop an ended mid-year assignment's share of an annual record", () => {
    const pastorA = window("pastorA", new Date(2023, 0, 1), new Date(2023, 5, 30)) // Jan–Jun
    const pastorB = window("pastorB", new Date(2023, 6, 1), null) // Jul–now
    const rows = [annual(2023, 22)]

    const result = attributeBaptisms(rows, [pastorA, pastorB])

    // The old point-in-time check gave pastorA exactly 0 here.
    expect(result.get("pastorA")).toBeGreaterThan(0)
    // Every baptism is accounted for somewhere — none vanish, none double up.
    const total = [...result.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(22)
  })

  it("prorates a whole-year record roughly by days served, not evenly", () => {
    // pastorA served ~1/4 of the year, pastorB the other ~3/4.
    const pastorA = window("pastorA", new Date(2023, 0, 1), new Date(2023, 2, 31))
    const pastorB = window("pastorB", new Date(2023, 3, 1), null)
    const result = attributeBaptisms([annual(2023, 100)], [pastorA, pastorB])

    const a = result.get("pastorA") ?? 0
    const b = result.get("pastorB") ?? 0
    expect(a + b).toBe(100)
    expect(a).toBeLessThan(b)
    expect(a).toBeGreaterThan(15)
    expect(a).toBeLessThan(30)
  })

  it("conserves the total across three assignments in one year (no leaks, no double-counting)", () => {
    const windows = [
      window("a1", new Date(2022, 0, 1), new Date(2022, 3, 30)),
      window("a2", new Date(2022, 4, 1), new Date(2022, 8, 30)),
      window("a3", new Date(2022, 9, 1), new Date(2022, 11, 31)),
    ]
    const rows = [annual(2022, 37), monthly(2022, 6, 4), monthly(2022, 11, 9)]
    const result = attributeBaptisms(rows, windows)
    const total = [...result.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(37 + 4 + 9)
    // The June monthly row belongs entirely to a2, the November one to a3.
    expect(result.get("a2")).toBeGreaterThanOrEqual(4)
    expect(result.get("a3")).toBeGreaterThanOrEqual(9)
  })

  it("attributes pre-history rows (before any known assignment) to the earliest tenure", () => {
    // No one else is on record as having managed this district before 2024,
    // so a 2020 record can't belong to some earlier pastor — it belongs to a1.
    const windows = [window("a1", new Date(2024, 0, 1), null)]
    const result = attributeBaptisms([annual(2020, 15)], windows)
    expect(result.get("a1")).toBe(15)
  })

  // Regression test for the exact issue reported: a brand-new district and a
  // brand-new pastor assignment (created "today"), where a MONTHLY record for
  // the current month was entered before the assignment's startDate (e.g. the
  // assignment starts on the 19th, but the record is pinned to the 15th of
  // the same month). The old code required the record's representative date
  // to fall on/after the assignment's startDate, so it matched no assignment
  // at all and silently reported 0 for the pastor while the district total
  // (which just sums every row) still showed the full count.
  it("attributes a same-month record entered before a brand-new assignment's start date", () => {
    const windows = [window("elvio", new Date(2026, 7, 19), null)] // Aug 19, 2026
    const rows = [monthly(2026, 8, 5), monthly(2026, 7, 5)] // Aug (pinned 15th) + Jul
    const result = attributeBaptisms(rows, windows)
    expect(result.get("elvio")).toBe(10)
  })

  it("skips zero-baptism rows without creating spurious entries", () => {
    const windows = [window("a1", new Date(2024, 0, 1), null)]
    const result = attributeBaptisms([annual(2024, 0)], windows)
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Cross-entity consistency: churches -> districts -> pastors must agree.
// This mirrors what getPastorDetail / getPastorBaptismRanking / church &
// district totals each compute, so a regression in any one of them shows up
// here without needing a database.
// ---------------------------------------------------------------------------
describe("cross-view consistency (church/district totals vs. pastor tenures)", () => {
  it("the sum of every pastor's tenure baptisms in a district-year equals the district's raw total for that year", () => {
    const church1: StatRow[] = [annual(2023, 22), monthly(2024, 2, 3)]
    const church2: StatRow[] = [monthly(2023, 8, 6)]
    const allRows = [...church1, ...church2]

    const windows = [
      window("pastorA", new Date(2023, 0, 1), new Date(2023, 5, 30)),
      window("pastorB", new Date(2023, 6, 1), new Date(2024, 0, 31)),
      window("pastorC", new Date(2024, 1, 1), null),
    ]

    // What the district/church detail pages show (computeChurchStats sums
    // every row regardless of who was pastor at the time).
    const districtTotal = computeChurchStats(allRows).baptismsTotal

    // What the pastor detail page would show, summed across every tenure.
    const attributed = attributeBaptisms(allRows, windows)
    const pastorSideTotal = [...attributed.values()].reduce((a, b) => a + b, 0)

    expect(pastorSideTotal).toBe(districtTotal)
  })
})

// ---------------------------------------------------------------------------
// resolveMemberCarryForward: used by the Excel statistics importer to fill in
// blank "Miembros" cells with the most recent known value for that church.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// membersAsOf: the stock carry-forward that keeps district aggregates honest.
// ---------------------------------------------------------------------------
describe("membersAsOf", () => {
  it("returns the latest snapshot at or before the given period", () => {
    const rows = [monthly(2025, 1, 0, 100), monthly(2025, 5, 0, 120), monthly(2025, 9, 0, 140)]
    expect(membersAsOf(rows, 2025, 5)).toBe(120)
    expect(membersAsOf(rows, 2025, 12)).toBe(140)
  })

  it("carries the previous year forward when the church skipped the period", () => {
    const rows = [monthly(2024, 11, 0, 90)]
    // No 2025 rows at all: the church still has the 90 members it last reported.
    expect(membersAsOf(rows, 2025, 6)).toBe(90)
  })

  it("ignores records from after the cutoff", () => {
    const rows = [monthly(2025, 3, 0, 100), monthly(2025, 8, 0, 200)]
    expect(membersAsOf(rows, 2025, 3)).toBe(100)
  })

  it("counts a year's annual close when asked for the end of that year", () => {
    const rows = [monthly(2024, 2, 0, 50), annual(2024, 0, 75)]
    // sortKey ranks monthly above the annual of the same year, so month 12 as
    // the cutoff must still include both — the annual row is the later data.
    expect(membersAsOf(rows, 2024, 12)).toBe(50)
    expect(membersAsOf(rows, 2024, 1)).toBe(75)
  })

  it("returns null when there is no data at or before the period", () => {
    expect(membersAsOf([], 2025, 6)).toBeNull()
    expect(membersAsOf([monthly(2026, 1, 0, 10)], 2025, 6)).toBeNull()
  })

  it("agrees with computeChurchStats for the church's most recent period", () => {
    const rows = [monthly(CURRENT_YEAR - 1, 12, 2, 80), monthly(CURRENT_YEAR, 3, 1, 95)]
    expect(membersAsOf(rows, CURRENT_YEAR, 12)).toBe(computeChurchStats(rows).currentMembers)
  })
})

describe("resolveMemberCarryForward", () => {
  it("carries the previous value forward through blank rows", () => {
    expect(resolveMemberCarryForward([100, null, null, 120], null)).toEqual([100, 100, 100, 120])
  })

  it("uses the given baseline when the first row is blank", () => {
    expect(resolveMemberCarryForward([null, null], 50)).toEqual([50, 50])
  })

  it("returns null when neither the baseline nor an earlier row has a value", () => {
    expect(resolveMemberCarryForward([null, 90], null)).toEqual([null, 90])
  })

  it("leaves provided values untouched even with no baseline", () => {
    expect(resolveMemberCarryForward([10, 20, 30], null)).toEqual([10, 20, 30])
  })
})
