import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { writeWorkbook } from "@/lib/excel"
import { STATISTIC_COLUMNS, STATISTIC_EXAMPLE_ROWS, columnLabels } from "@/lib/excel-schemas"

// Same column shape as the statistics import (STATISTIC_COLUMNS /
// importDistrictStatistics) so the download can be edited and re-imported
// directly. `?districtId=` limits the export to a single district;
// `?template=1` returns the headers plus example rows instead of the data.
export async function GET(request: Request) {
  const ctx = await requireSession()
  const params = new URL(request.url).searchParams
  const districtId = params.get("districtId") ?? undefined
  const headers = columnLabels(STATISTIC_COLUMNS)

  if (params.get("template") === "1") {
    return xlsxResponse(
      await writeWorkbook(headers, STATISTIC_EXAMPLE_ROWS),
      "plantilla-estadisticas.xlsx",
    )
  }

  const records = await prisma.statisticRecord.findMany({
    where: {
      organizationId: ctx.organizationId,
      period: "MONTHLY",
      church: districtId ? { districtId } : undefined,
    },
    include: { church: { select: { name: true, district: { select: { name: true } } } } },
    orderBy: [
      { church: { district: { name: "asc" } } },
      { church: { name: "asc" } },
      { year: "asc" },
      { month: "asc" },
    ],
  })

  const rows = records.map((r) => [
    r.church.district.name,
    r.church.name,
    r.year,
    r.month ?? "",
    r.memberCount,
    r.baptismCount,
  ])

  return xlsxResponse(await writeWorkbook(headers, rows), "estadisticas.xlsx")
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
