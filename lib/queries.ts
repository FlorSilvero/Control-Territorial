import "server-only"
import { prisma } from "@/lib/prisma"
import { normalizeText } from "@/lib/utils"
import {
  computeChurchStats,
  assignmentForDate,
  assignmentForDateOrEarliest,
  attributeBaptisms,
  membersAsOf,
  CURRENT_YEAR,
  CURRENT_MONTH,
  type StatRow,
  type AssignmentWindow,
} from "@/lib/stats"

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

export async function listDistricts(orgId: string, opts: { archived?: boolean } = {}) {
  const districts = await prisma.district.findMany({
    where: { organizationId: orgId, archivedAt: opts.archived ? { not: null } : null },
    include: {
      churches: {
        where: { archivedAt: null },
        include: { statistics: true },
      },
      assignments: {
        where: { endDate: null },
        include: { pastor: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  })

  return districts.map((d) => {
    let totalMembers = 0
    let baptismsThisYear = 0
    let baptismsTotal = 0
    for (const c of d.churches) {
      const s = computeChurchStats(c.statistics as StatRow[])
      totalMembers += s.currentMembers
      baptismsThisYear += s.baptismsThisYear
      baptismsTotal += s.baptismsTotal
    }
    const current = d.assignments[0]
    return {
      id: d.id,
      name: d.name,
      notes: d.notes,
      archivedAt: d.archivedAt,
      churchCount: d.churches.length,
      totalMembers,
      baptismsThisYear,
      baptismsTotal,
      currentPastor: current?.pastor
        ? {
            id: current.pastor.id,
            firstName: current.pastor.firstName,
            lastName: current.pastor.lastName,
            since: current.startDate,
          }
        : null,
    }
  })
}

export async function getDistrictDetail(orgId: string, id: string) {
  const district = await prisma.district.findFirst({
    where: { id, organizationId: orgId },
    include: {
      churches: {
        where: { archivedAt: null },
        include: { statistics: true },
        orderBy: { name: "asc" },
      },
      assignments: {
        include: { pastor: true },
        orderBy: { startDate: "desc" },
      },
    },
  })
  if (!district) return null

  const windows: AssignmentWindow[] = district.assignments.map((a) => ({
    id: a.id,
    pastorId: a.pastorId,
    districtId: a.districtId,
    startDate: a.startDate,
    endDate: a.endDate,
    pastor: a.pastor,
  }))

  let totalMembers = 0
  let baptismsThisYear = 0
  let baptismsTotal = 0
  const churches = district.churches.map((c) => {
    const s = computeChurchStats(c.statistics as StatRow[])
    totalMembers += s.currentMembers
    baptismsThisYear += s.baptismsThisYear
    baptismsTotal += s.baptismsTotal
    return {
      id: c.id,
      name: c.name,
      currentMembers: s.currentMembers,
      baptismsThisYear: s.baptismsThisYear,
      baptismsTotal: s.baptismsTotal,
    }
  })

  const currentAssignment = district.assignments.find((a) => a.endDate === null) ?? null

  // Grouped per church — see buildYearlyHistory for why this must not be flattened.
  const rowsByChurch: StatRow[][] = district.churches.map((c) => c.statistics as StatRow[])

  const yearly = buildYearlyHistory(rowsByChurch, windows)
  const monthly = buildMonthlyHistory(rowsByChurch, windows)

  return {
    id: district.id,
    name: district.name,
    notes: district.notes,
    archivedAt: district.archivedAt,
    churchCount: district.churches.length,
    totalMembers,
    baptismsThisYear,
    baptismsTotal,
    currentAssignment: currentAssignment
      ? {
          id: currentAssignment.id,
          startDate: currentAssignment.startDate,
          pastor: currentAssignment.pastor,
        }
      : null,
    churches,
    assignments: district.assignments.map((a) => ({
      id: a.id,
      startDate: a.startDate,
      endDate: a.endDate,
      pastor: a.pastor,
    })),
    yearly,
    monthly,
  }
}

// ---------------------------------------------------------------------------
// History builders (shared by district + church detail)
// ---------------------------------------------------------------------------

export type YearlyRow = {
  year: number
  members: number
  baptisms: number
  pastor: { id: string; firstName: string; lastName: string } | null
}

export type MonthlyRow = {
  month: number
  members: number
  baptisms: number
  pastor: { id: string; firstName: string; lastName: string } | null
}

/**
 * Both builders take rows GROUPED BY CHURCH (one array per church), not a
 * flat list. That grouping is what makes the member column correct: members
 * are a stock, so a period's total is the sum of every church's latest
 * snapshot as of that period — including churches that didn't report in it.
 * Flattening first made a church invisible for any period it skipped, so a
 * district's history table could report a fraction of the member total shown
 * on its own summary card. Baptisms are a flow and are simply summed.
 */
function buildYearlyHistory(
  rowsByChurch: StatRow[][],
  windows: AssignmentWindow[],
): YearlyRow[] {
  const allRows = rowsByChurch.flat()
  // Most recent year first.
  const years = Array.from(new Set(allRows.map((r) => r.year))).sort((a, b) => b - a)

  return years.map((year) => {
    const baptisms = allRows.reduce(
      (acc, r) => (r.year === year ? acc + r.baptismCount : acc),
      0,
    )
    const members = rowsByChurch.reduce(
      (acc, churchRows) => acc + (membersAsOf(churchRows, year, 12) ?? 0),
      0,
    )
    const repDate = year === CURRENT_YEAR ? new Date() : new Date(year, 11, 31)
    const a = assignmentForDate(windows, repDate)
    return {
      year,
      members,
      baptisms,
      pastor: a?.pastor ?? null,
    }
  })
}

function buildMonthlyHistory(
  rowsByChurch: StatRow[][],
  windows: AssignmentWindow[],
): MonthlyRow[] {
  const allRows = rowsByChurch.flat()
  const result: MonthlyRow[] = []
  // Most recent month first.
  for (let month = CURRENT_MONTH; month >= 1; month--) {
    const baptisms = allRows.reduce(
      (acc, r) =>
        r.year === CURRENT_YEAR && r.month === month ? acc + r.baptismCount : acc,
      0,
    )
    const members = rowsByChurch.reduce(
      (acc, churchRows) => acc + (membersAsOf(churchRows, CURRENT_YEAR, month) ?? 0),
      0,
    )
    const repDate = new Date(CURRENT_YEAR, month - 1, 15)
    const a = assignmentForDate(windows, repDate)
    result.push({ month, members, baptisms, pastor: a?.pastor ?? null })
  }
  return result
}

// ---------------------------------------------------------------------------
// Churches
// ---------------------------------------------------------------------------

export async function listChurches(
  orgId: string,
  opts: { archived?: boolean; search?: string; districtId?: string } = {},
) {
  const churches = await prisma.church.findMany({
    where: {
      organizationId: orgId,
      archivedAt: opts.archived ? { not: null } : null,
      districtId: opts.districtId || undefined,
    },
    include: {
      statistics: true,
      district: {
        include: {
          assignments: { where: { endDate: null }, include: { pastor: true }, take: 1 },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  const term = opts.search ? normalizeText(opts.search) : null
  const filtered = term ? churches.filter((c) => normalizeText(c.name).includes(term)) : churches

  return filtered.map((c) => {
    const s = computeChurchStats(c.statistics as StatRow[])
    const current = c.district.assignments[0]
    return {
      id: c.id,
      name: c.name,
      archivedAt: c.archivedAt,
      district: { id: c.district.id, name: c.district.name },
      currentPastor: current?.pastor
        ? { id: current.pastor.id, firstName: current.pastor.firstName, lastName: current.pastor.lastName }
        : null,
      currentMembers: s.currentMembers,
      baptismsThisYear: s.baptismsThisYear,
      baptismsTotal: s.baptismsTotal,
      membersTrend: s.membersTrend,
    }
  })
}

export async function getChurchDetail(orgId: string, id: string) {
  const church = await prisma.church.findFirst({
    where: { id, organizationId: orgId },
    include: {
      statistics: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      district: {
        include: {
          assignments: { include: { pastor: true }, orderBy: { startDate: "desc" } },
        },
      },
    },
  })
  if (!church) return null

  const windows: AssignmentWindow[] = church.district.assignments.map((a) => ({
    id: a.id,
    pastorId: a.pastorId,
    districtId: a.districtId,
    startDate: a.startDate,
    endDate: a.endDate,
    pastor: a.pastor,
  }))

  // Keep the full Prisma rows rather than casting to StatRow: the detail table
  // needs each record's id to edit or delete it, and the cast silently dropped
  // that field from the type while the value was there all along.
  const statistics = church.statistics
  const s = computeChurchStats(statistics)
  const current = church.district.assignments.find((a) => a.endDate === null) ?? null

  // A single church is a one-element group — same builder as the district view.
  const yearly = buildYearlyHistory([statistics], windows)

  return {
    id: church.id,
    name: church.name,
    address: church.address,
    notes: church.notes,
    archivedAt: church.archivedAt,
    district: { id: church.district.id, name: church.district.name },
    currentPastor: current?.pastor ?? null,
    currentMembers: s.currentMembers,
    baptismsThisYear: s.baptismsThisYear,
    baptismsTotal: s.baptismsTotal,
    statistics,
    yearly,
  }
}

// ---------------------------------------------------------------------------
// Pastors
// ---------------------------------------------------------------------------

export async function listPastors(orgId: string, opts: { archived?: boolean } = {}) {
  const pastors = await prisma.pastor.findMany({
    where: { organizationId: orgId, archivedAt: opts.archived ? { not: null } : null },
    include: {
      assignments: {
        include: { district: true },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: { lastName: "asc" },
  })

  return pastors.map((p) => {
    const current = p.assignments.find((a) => a.endDate === null) ?? null
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      archivedAt: p.archivedAt,
      currentDistrict: current
        ? { id: current.district.id, name: current.district.name, since: current.startDate }
        : null,
      assignmentCount: p.assignments.length,
    }
  })
}

export async function getPastorDetail(orgId: string, id: string) {
  const pastor = await prisma.pastor.findFirst({
    where: { id, organizationId: orgId },
    include: {
      assignments: {
        include: {
          district: {
            include: {
              churches: { where: { archivedAt: null }, include: { statistics: true } },
              // Every assignment for the district (any pastor), needed to
              // correctly split whole-year statistic rows across tenures.
              assignments: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      },
    },
  })
  if (!pastor) return null

  const assignments = pastor.assignments.map((a) => {
    const rows: StatRow[] = a.district.churches.flatMap((c) => c.statistics as StatRow[])
    const districtWindows: AssignmentWindow[] = a.district.assignments.map((w) => ({
      id: w.id,
      pastorId: w.pastorId,
      districtId: w.districtId,
      startDate: w.startDate,
      endDate: w.endDate,
    }))

    const baptisms = attributeBaptisms(rows, districtWindows).get(a.id) ?? 0

    // Monthly breakdown (active tenure only): MONTHLY rows pin an exact
    // month, so a direct window lookup is precise here (no proration needed).
    // Falls back to the earliest tenure for pre-history rows, same as
    // attributeBaptisms above, so this breakdown always sums back to `baptisms`.
    const monthly: { month: number; baptisms: number }[] = []
    for (let m = 1; m <= 12; m++) monthly.push({ month: m, baptisms: 0 })
    for (const r of rows) {
      if (r.year !== CURRENT_YEAR || !r.month) continue
      const owner = assignmentForDateOrEarliest(districtWindows, new Date(r.year, r.month - 1, 15))
      if (owner?.id === a.id) monthly[r.month - 1].baptisms += r.baptismCount
    }

    return {
      id: a.id,
      district: { id: a.district.id, name: a.district.name },
      startDate: a.startDate,
      endDate: a.endDate,
      baptisms,
      currentYearMonthly: a.endDate === null ? monthly.slice(0, CURRENT_MONTH) : null,
    }
  })

  // Active tenure (endDate null) always leads, regardless of its startDate;
  // the rest follow most-recent-first. A plain startDate-desc sort can't
  // guarantee this when a past tenure happens to start later than the one
  // still in progress.
  assignments.sort((a, b) => {
    if (a.endDate === null) return -1
    if (b.endDate === null) return 1
    return b.startDate.getTime() - a.startDate.getTime()
  })

  const current = pastor.assignments.find((a) => a.endDate === null) ?? null

  return {
    id: pastor.id,
    firstName: pastor.firstName,
    lastName: pastor.lastName,
    email: pastor.email,
    phone: pastor.phone,
    notes: pastor.notes,
    archivedAt: pastor.archivedAt,
    currentDistrict: current
      ? { id: current.district.id, name: current.district.name, since: current.startDate }
      : null,
    assignments,
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardData(orgId: string) {
  const [districts, pastorCount] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: orgId, archivedAt: null },
      include: {
        churches: { where: { archivedAt: null }, include: { statistics: true } },
        assignments: { where: { endDate: null }, include: { pastor: true }, take: 1 },
      },
    }),
    prisma.pastor.count({ where: { organizationId: orgId, archivedAt: null } }),
  ])

  let churchCount = 0
  let totalMembers = 0
  let totalBaptisms = 0

  const districtRanking: { name: string; baptisms: number; members: number }[] = []
  const churchRanking: { name: string; district: string; baptisms: number }[] = []
  const yearMap = new Map<number, number>()
  const monthMap = new Map<number, number>()
  const membersByDistrict: { name: string; members: number }[] = []

  for (const d of districts) {
    let dBaptisms = 0
    let dMembers = 0
    for (const c of d.churches) {
      churchCount++
      const s = computeChurchStats(c.statistics as StatRow[])
      totalMembers += s.currentMembers
      dMembers += s.currentMembers
      for (const r of c.statistics as StatRow[]) {
        totalBaptisms += r.baptismCount
        dBaptisms += r.baptismCount
        yearMap.set(r.year, (yearMap.get(r.year) ?? 0) + r.baptismCount)
        if (r.year === CURRENT_YEAR && r.month) {
          monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.baptismCount)
        }
      }
      churchRanking.push({
        name: c.name,
        district: d.name,
        baptisms: s.baptismsTotal,
      })
    }
    districtRanking.push({ name: d.name, baptisms: dBaptisms, members: dMembers })
    membersByDistrict.push({ name: d.name, members: dMembers })
  }

  const baptismsByYear = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, baptisms]) => ({ year: String(year), baptisms }))

  const baptismsByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([month, baptisms]) => ({ month, baptisms }))

  // Pastors ranked by baptisms during their tenures.
  const pastorRanking = await getPastorBaptismRanking(orgId)

  return {
    kpis: {
      districts: districts.length,
      churches: churchCount,
      pastors: pastorCount,
      members: totalMembers,
      baptisms: totalBaptisms,
    },
    topDistricts: [...districtRanking].sort((a, b) => b.baptisms - a.baptisms).slice(0, 5),
    topChurches: [...churchRanking].sort((a, b) => b.baptisms - a.baptisms).slice(0, 5),
    membersByDistrict: membersByDistrict.sort((a, b) => b.members - a.members),
    baptismsByYear,
    baptismsByMonth,
    pastorRanking,
  }
}

async function getPastorBaptismRanking(orgId: string) {
  // Walk district-by-district so each statistic row is attributed once,
  // against the *complete* set of assignments that overlap it — matching
  // getPastorDetail's logic exactly, so the two views always agree.
  const districts = await prisma.district.findMany({
    where: { organizationId: orgId },
    include: {
      churches: { where: { archivedAt: null }, include: { statistics: true } },
      assignments: { include: { pastor: true } },
    },
  })

  const totals = new Map<string, { name: string; baptisms: number; archived: boolean }>()

  for (const d of districts) {
    const rows: StatRow[] = d.churches.flatMap((c) => c.statistics as StatRow[])
    const windows: AssignmentWindow[] = d.assignments.map((a) => ({
      id: a.id,
      pastorId: a.pastorId,
      districtId: a.districtId,
      startDate: a.startDate,
      endDate: a.endDate,
    }))
    const attributed = attributeBaptisms(rows, windows)

    for (const a of d.assignments) {
      const amount = attributed.get(a.id) ?? 0
      if (amount === 0) continue
      const existing = totals.get(a.pastorId)
      totals.set(a.pastorId, {
        name: `${a.pastor.firstName} ${a.pastor.lastName}`,
        baptisms: (existing?.baptisms ?? 0) + amount,
        archived: a.pastor.archivedAt != null,
      })
    }
  }

  return Array.from(totals.values())
    .filter((p) => !p.archived)
    .sort((a, b) => b.baptisms - a.baptisms)
    .slice(0, 5)
    .map(({ name, baptisms }) => ({ name, baptisms }))
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export type SearchResult = {
  id: string
  type: "district" | "church" | "pastor"
  label: string
  sublabel: string
}

export async function globalSearch(orgId: string, q: string): Promise<SearchResult[]> {
  const term = normalizeText(q)
  if (!term) return []

  // Diacritics can't be stripped inside a Postgres ILIKE via Prisma, so we
  // fetch the tenant's active rows (small per-org scale) and match on
  // normalized text in JS instead — "Jose" must find "José".
  const [districts, churches, pastors] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, name: true },
    }),
    prisma.church.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, name: true, district: { select: { name: true } } },
    }),
    prisma.pastor.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
  ])

  return [
    ...districts
      .filter((d) => normalizeText(d.name).includes(term))
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        type: "district" as const,
        label: d.name,
        sublabel: "Distrito",
      })),
    ...churches
      .filter((c) => normalizeText(c.name).includes(term))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        type: "church" as const,
        label: c.name,
        sublabel: `Iglesia · ${c.district.name}`,
      })),
    ...pastors
      .filter((p) => normalizeText(`${p.firstName} ${p.lastName}`).includes(term))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        type: "pastor" as const,
        label: `${p.firstName} ${p.lastName}`,
        sublabel: "Pastor",
      })),
  ]
}

// ---------------------------------------------------------------------------
// Shared select lists (for forms)
// ---------------------------------------------------------------------------

export async function getDistrictOptions(orgId: string) {
  return prisma.district.findMany({
    where: { organizationId: orgId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export async function getPastorOptions(orgId: string) {
  const pastors = await prisma.pastor.findMany({
    where: { organizationId: orgId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  })
  return pastors.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))
}
