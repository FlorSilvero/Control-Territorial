import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { writeWorkbook } from "@/lib/excel"

// Same column shape as the statistics import template
// (import-district-stats-dialog.tsx / importDistrictStatistics) so the
// download can be edited and re-imported directly. `?districtId=` limits the
// export to a single district.
export async function GET(request: Request) {
  const ctx = await requireSession()
  const districtId = new URL(request.url).searchParams.get("districtId") ?? undefined

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

  const headers = ["Distrito", "Iglesia", "Año", "Mes", "Miembros", "Bautismos"]
  const rows = records.map((r) => [
    r.church.district.name,
    r.church.name,
    r.year,
    r.month ?? "",
    r.memberCount,
    r.baptismCount,
  ])

  const buffer = await writeWorkbook(headers, rows)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="estadisticas.xlsx"',
    },
  })
}
