import { NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { listChurches } from "@/lib/queries"
import { writeWorkbook } from "@/lib/excel"
import { ROSTER_COLUMNS, ROSTER_EXAMPLE_ROWS, columnLabels } from "@/lib/excel-schemas"
import { congregationTypeLabel } from "@/lib/format"
import { rosterPastorName } from "@/lib/pastor-names"

// Same column shape as the roster import (ROSTER_COLUMNS / importRoster) so the
// download can be edited and re-imported directly. `?template=1` returns the
// headers plus example rows instead of the data.
export async function GET(request: Request) {
  const ctx = await requireSession()
  const headers = columnLabels(ROSTER_COLUMNS)

  if (new URL(request.url).searchParams.get("template") === "1") {
    return xlsxResponse(
      await writeWorkbook(headers, ROSTER_EXAMPLE_ROWS, "Distritos"),
      "plantilla-distritos.xlsx",
    )
  }

  const churches = await listChurches(ctx.organizationId)

  // Grouped the way the planilla reads: every congregation of a district
  // together, districts alphabetical, congregations alphabetical within each.
  const collator = new Intl.Collator("es")
  const rows = churches
    .sort(
      (a, b) =>
        collator.compare(a.district.name, b.district.name) || collator.compare(a.name, b.name),
    )
    .map((c) => [
      c.currentPastor ? rosterPastorName(c.currentPastor.firstName, c.currentPastor.lastName) : "",
      c.district.name,
      c.name,
      congregationTypeLabel(c.type),
      c.currentMembers,
    ])

  return xlsxResponse(await writeWorkbook(headers, rows, "Distritos"), "distritos.xlsx")
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
