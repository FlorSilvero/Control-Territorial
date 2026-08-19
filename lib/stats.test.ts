import { describe, it, expect } from "vitest"
import {
  computeChurchStats,
  representativeDate,
  assignmentForDate,
  attributeBaptisms,
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
    expect(stats).toEqual({ currentMembers: 0, baptismsThisYear: 0, baptismsTotal: 0 })
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

  it("ignores rows that fall in years no assignment covers", () => {
    const windows = [window("a1", new Date(2024, 0, 1), null)]
    const result = attributeBaptisms([annual(2020, 15)], windows)
    expect(result.size).toBe(0)
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
