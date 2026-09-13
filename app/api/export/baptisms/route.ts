import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { writeSheets, type SheetSpec } from "@/lib/excel"
import {
  BAPTISM_MATRIX_COLUMNS,
  BAPTISM_MATRIX_EXAMPLE_ROWS,
  columnLabels,
} from "@/lib/excel-schemas"
import { assignmentForDate, CURRENT_YEAR, type AssignmentWindow } from "@/lib/stats"

/**
 * The "Bautismos <año>" planilla: one sheet per year, one row per district, one
 * column per month, closed by the entity total — the same layout the entity
 * keeps its history in, so a download can be edited in Excel and imported back
 * through importBaptismMatrix without touching a single header.
 *
 * `?year=2025` exports that year only; `?template=1` returns the headers plus
 * example rows instead of the data.
 */
export async function GET(request: Request) {
  const ctx = await requireSession()
  const params = new URL(request.url).searchParams
  const headers = columnLabels(BAPTISM_MATRIX_COLUMNS)

  if (params.get("template") === "1") {
    return xlsxResponse(
      await writeSheets([
        {
          name: `Bautismos ${CURRENT_YEAR}`,
          headers,
          rows: BAPTISM_MATRIX_EXAMPLE_ROWS,
        },
      ]),
      "plantilla-bautismos.xlsx",
    )
  }

  const yearParam = params.get("year")
  const onlyYear = yearParam ? Number(yearParam) : null
  if (yearParam && !Number.isInteger(onlyYear)) {
    return NextResponse.json({ error: `Año inválido: "${yearParam}"` }, { status: 400 })
  }

  const districts = await prisma.district.findMany({
    where: { organizationId: ctx.organizationId, archivedAt: null },
    include: {
      churches: {
        where: { archivedAt: null },
        include: {
          statistics: {
            where: { period: "MONTHLY", month: { not: null }, year: onlyYear ?? undefined },
          },
        },
      },
      assignments: { include: { pastor: true }, orderBy: { startDate: "desc" } },
    },
    orderBy: { name: "asc" },
  })

  // district id -> "year|month" -> baptisms, summed across its congregations.
  const byDistrict = new Map<string, Map<string, number>>()
  const years = new Set<number>()
  for (const d of districts) {
    const cells = new Map<string, number>()
    for (const c of d.churches) {
      for (const s of c.statistics) {
        if (s.month == null) continue
        years.add(s.year)
        const key = `${s.year}|${s.month}`
        cells.set(key, (cells.get(key) ?? 0) + s.baptismCount)
      }
    }
    byDistrict.set(d.id, cells)
  }

  // An empty database still downloads as a usable sheet for the current year
  // rather than a workbook with no sheets at all.
  if (onlyYear != null) years.add(onlyYear)
  if (years.size === 0) years.add(CURRENT_YEAR)

  const sheets: SheetSpec[] = [...years]
    .sort((a, b) => b - a)
    .map((year) => ({
      name: `Bautismos ${year}`,
      headers,
      rows: yearRows(districts, byDistrict, year),
    }))

  return xlsxResponse(await writeSheets(sheets), fileName(onlyYear))
}

type DistrictWithPastors = {
  id: string
  name: string
  assignments: {
    id: string
    pastorId: string
    districtId: string
    startDate: Date
    endDate: Date | null
    pastor: { id: string; firstName: string; lastName: string }
  }[]
}

function yearRows(
  districts: DistrictWithPastors[],
  byDistrict: Map<string, Map<string, number>>,
  year: number,
): (string | number)[][] {
  const monthTotals = new Array(12).fill(0)
  let entityTotal = 0

  const rows = districts.map((d) => {
    const cells = byDistrict.get(d.id) ?? new Map<string, number>()
    let total = 0
    const months: (string | number)[] = []

    for (let month = 1; month <= 12; month++) {
      const value = cells.get(`${year}|${month}`)
      // A month nobody reported stays blank, the way the planilla writes it;
      // a reported zero is written as 0 so the two stay distinguishable.
      if (value == null) {
        months.push("")
        continue
      }
      months.push(value)
      total += value
      monthTotals[month - 1] += value
    }

    entityTotal += total
    return [d.name, responsableFor(d, year), ...months, total, "", ""]
  })

  rows.push(["Total de la Entidad", "", ...monthTotals, entityTotal, "", ""])
  return rows
}

/**
 * The pastor in charge during that year, so an exported sheet names whoever
 * actually served it rather than today's pastor on every historical sheet.
 */
function responsableFor(district: DistrictWithPastors, year: number): string {
  const windows: AssignmentWindow[] = district.assignments.map((a) => ({
    id: a.id,
    pastorId: a.pastorId,
    districtId: a.districtId,
    startDate: a.startDate,
    endDate: a.endDate,
    pastor: a.pastor,
  }))
  const repDate = year === CURRENT_YEAR ? new Date() : new Date(year, 11, 31)
  const match = assignmentForDate(windows, repDate)
  return match?.pastor ? `${match.pastor.lastName}, ${match.pastor.firstName}` : ""
}

function fileName(onlyYear: number | null): string {
  return onlyYear == null ? "bautismos.xlsx" : `bautismos-${onlyYear}.xlsx`
}

function xlsxResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
