import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { writeWorkbook } from "@/lib/excel"
import { PASTOR_COLUMNS, PASTOR_EXAMPLE_ROWS, columnLabels } from "@/lib/excel-schemas"

// Same column shape as the pastor import (PASTOR_COLUMNS / importPastors) so
// the download can be edited and re-imported directly. `?template=1` returns
// the headers plus one example row instead of the real data, which is what a
// brand-new organization needs to get started.
export async function GET(request: Request) {
  const ctx = await requireSession()
  const isTemplate = new URL(request.url).searchParams.get("template") === "1"
  const headers = columnLabels(PASTOR_COLUMNS)

  if (isTemplate) {
    return xlsxResponse(await writeWorkbook(headers, PASTOR_EXAMPLE_ROWS), "plantilla-pastores.xlsx")
  }

  const pastors = await prisma.pastor.findMany({
    where: { organizationId: ctx.organizationId, archivedAt: null },
    include: {
      assignments: {
        where: { endDate: null },
        include: { district: { select: { name: true } } },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const rows = pastors.map((p) => {
    const current = p.assignments[0]
    return [
      p.firstName,
      p.lastName,
      p.email ?? "",
      p.phone ?? "",
      p.spouseName ?? "",
      p.childrenNames ?? "",
      current?.district.name ?? "",
      current ? current.startDate.toISOString().slice(0, 10) : "",
      p.notes ?? "",
    ]
  })

  return xlsxResponse(await writeWorkbook(headers, rows), "pastores.xlsx")
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
