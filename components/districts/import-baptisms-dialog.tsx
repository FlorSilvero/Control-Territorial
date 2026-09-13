"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExcelColumnsPreview } from "@/components/shared/excel-columns-preview"
import { ImportErrorList } from "@/components/shared/import-error-list"
import {
  BAPTISM_MATRIX_COLUMNS,
  BAPTISM_MATRIX_EXAMPLE_ROWS,
  MONTH_COLUMNS,
} from "@/lib/excel-schemas"
import {
  previewBaptismMatrix,
  importBaptismMatrix,
  type BaptismMatrixPreview,
  type ImportBaptismMatrixSummary,
} from "@/lib/actions/import-baptism-matrix"
import { formatNumber } from "@/lib/format"
import { toast } from "sonner"

const now = new Date()

/**
 * Two-step import of the "Bautismos" planilla: the file is always dry-run
 * first, so what gets written is a list of before → after changes the user has
 * actually seen. The same file is uploaded again to apply, which keeps the
 * server stateless between the two steps.
 */
export function ImportBaptismsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [year, setYear] = useState(String(now.getFullYear()))
  const [preview, setPreview] = useState<BaptismMatrixPreview | null>(null)
  const [summary, setSummary] = useState<ImportBaptismMatrixSummary | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const reset = () => {
    setPreview(null)
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  /** The picked file plus the fallback year, for either step. */
  const buildFormData = (): FormData | null => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error("Seleccioná un archivo .xlsx")
      return null
    }
    const formData = new FormData()
    formData.set("file", file)
    formData.set("year", year)
    return formData
  }

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = buildFormData()
    if (!formData) return

    setSummary(null)
    startTransition(async () => {
      const res = await previewBaptismMatrix(formData)
      if (res.ok) setPreview(res.preview)
      else toast.error(res.error || "Ocurrió un error al leer el archivo")
    })
  }

  const handleApply = () => {
    const formData = buildFormData()
    if (!formData) return

    startTransition(async () => {
      const res = await importBaptismMatrix(formData)
      if (res.ok) {
        setSummary(res.summary)
        setPreview(null)
        router.refresh()
        toast.success(`${res.summary.saved} períodos actualizados`)
      } else {
        toast.error(res.error || "Ocurrió un error al importar")
      }
    })
  }

  // A preview is only good for the file and year it was built from, so
  // changing either drops it rather than letting "Aplicar" write something the
  // user never saw.
  const invalidatePreview = () => {
    setPreview(null)
    setSummary(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar planilla de bautismos</DialogTitle>
          <DialogDescription>
            Una fila por distrito y una columna por mes, con una hoja por año. Antes de guardar vas
            a ver exactamente qué cambia.
          </DialogDescription>
        </DialogHeader>

        <ExcelColumnsPreview
          columns={BAPTISM_MATRIX_COLUMNS}
          exampleRows={BAPTISM_MATRIX_EXAMPLE_ROWS}
          templateHref="/api/export/baptisms?template=1"
        />
        <p className="text-[11px] text-muted-foreground">
          El total mensual de cada distrito se guarda en su congregación cabecera (la del mismo
          nombre que el distrito, o la de mayor membresía). Dentro de un año ya transcurrido, un mes
          vacío se guarda como 0 bautismos; los meses que todavía no llegaron se ignoran. Responsable,
          Total, Blanco y % son informativos: no se importan. La membresía no se toca.
        </p>

        <form onSubmit={handlePreview} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="baptisms-file">Archivo .xlsx</Label>
              <Input
                id="baptisms-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                required
                onChange={invalidatePreview}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baptisms-year">Año por defecto</Label>
              <Input
                id="baptisms-year"
                type="number"
                min={1900}
                max={now.getFullYear() + 1}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value)
                  invalidatePreview()
                }}
                required
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            El año sale del nombre de cada hoja (&ldquo;Bautismos 2025&rdquo;) o de una columna Año.
            El año por defecto se usa sólo cuando el archivo no lo dice en ninguna parte.
          </p>

          {preview && <PreviewPanel preview={preview} />}
          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {formatNumber(summary.saved)} períodos actualizados
                {summary.unchangedCount > 0 &&
                  ` · ${formatNumber(summary.unchangedCount)} ya estaban igual`}
                {summary.errorCount > 0 && ` · ${formatNumber(summary.errorCount)} con error`}
              </p>
              <ImportErrorList errors={summary.errors} errorCount={summary.errorCount} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cerrar
            </Button>
            {preview && preview.changeCount > 0 ? (
              <Button type="button" onClick={handleApply} disabled={isPending}>
                {isPending
                  ? "Guardando..."
                  : `Aplicar ${formatNumber(preview.changeCount)} cambios`}
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Leyendo..." : "Revisar cambios"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PreviewPanel({ preview }: { preview: BaptismMatrixPreview }) {
  const { changes, changeCount, createdCount, unchangedCount, years, errorCount } = preview
  const hidden = changeCount - changes.length

  return (
    <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
      <p className="font-medium">
        {changeCount === 0
          ? "No hay nada que cambiar: el archivo coincide con lo que ya está cargado."
          : `${formatNumber(changeCount)} períodos cambian (${formatNumber(createdCount)} nuevos)`}
        {unchangedCount > 0 && ` · ${formatNumber(unchangedCount)} sin cambios`}
        {years.length > 0 && ` · ${years.join(", ")}`}
      </p>

      {changes.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-md border bg-background">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1.5 font-medium">Distrito</th>
                <th className="px-2 py-1.5 font-medium">Período</th>
                <th className="px-2 py-1.5 font-medium text-right">Antes</th>
                <th className="px-2 py-1.5 font-medium text-right">Después</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={`${c.districtName}-${c.year}-${c.month}`} className="border-t">
                  <td className="px-2 py-1 whitespace-nowrap">{c.districtName}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">
                    {MONTH_COLUMNS[c.month - 1].label} {c.year}
                  </td>
                  <td className="px-2 py-1 text-right text-muted-foreground">
                    {c.before === null ? "—" : formatNumber(c.before)}
                  </td>
                  <td className="px-2 py-1 text-right font-medium">{formatNumber(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hidden > 0 && (
        <p className="text-muted-foreground">
          …y {formatNumber(hidden)} cambios más que no se listan acá. Se aplican todos.
        </p>
      )}

      {errorCount > 0 && (
        <>
          <p className="font-medium text-destructive">
            {formatNumber(errorCount)} filas con problemas (se importa el resto):
          </p>
          <ImportErrorList errors={preview.errors} errorCount={errorCount} />
        </>
      )}
    </div>
  )
}
