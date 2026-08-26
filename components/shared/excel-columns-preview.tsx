import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { aliasesOf, type ColumnSpec } from "@/lib/excel-schemas"

/**
 * Renders the expected .xlsx layout for an import: the exact header row plus
 * the example rows the downloadable template contains. Both come from the same
 * ColumnSpec list the importer reads with, so the preview can't drift from
 * what the server actually accepts.
 */
export function ExcelColumnsPreview({
  columns,
  exampleRows,
  templateHref,
}: {
  columns: readonly ColumnSpec[]
  exampleRows: string[][]
  templateHref: string
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-md border text-xs overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label}
                  title={`Encabezados aceptados: ${aliasesOf(col).join(", ")}`}
                  className="px-2 py-1.5 font-medium whitespace-nowrap"
                >
                  {col.label}
                  {col.required && <span className="text-destructive"> *</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {exampleRows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((col, j) => (
                  <td key={col.label} className="px-2 py-1.5 whitespace-nowrap">
                    {row[j] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="text-destructive">*</span> obligatorio. El orden de las columnas no
          importa y las tildes/mayúsculas del encabezado tampoco.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={templateHref} />}
          className="gap-1.5 shrink-0"
        >
          <Download className="size-3.5" />
          Descargar plantilla
        </Button>
      </div>
    </div>
  )
}
