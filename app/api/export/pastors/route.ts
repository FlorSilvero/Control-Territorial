import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"
import { writeWorkbook } from "@/lib/excel"

// Same column shape as the pastor import template (import-pastors-dialog.tsx /
// importPastors) so the download can be edited and re-imported directly.
export async function GET() {
  const ctx = await requireSession()

  const pastors = await prisma.pastor.findMany({
    where: { organizationId: ctx.organizationId, archivedAt: null },
    include: {
      assignments: {
        where: { endDate: null },
        include: { district: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const headers = ["Nombre", "Apellido", "Email", "Teléfono", "Distrito", "Fecha inicio", "Notas"]
  const rows = pastors.map((p) => {
    const current = p.assignments[0]
    return [
      p.firstName,
      p.lastName,
      p.email ?? "",
      p.phone ?? "",
      current?.district.name ?? "",
      current ? current.startDate.toISOString().slice(0, 10) : "",
      p.notes ?? "",
    ]
  })

  const buffer = await writeWorkbook(headers, rows)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pastores.xlsx"',
    },
  })
}
