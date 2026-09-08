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
import { ROSTER_COLUMNS, ROSTER_EXAMPLE_ROWS } from "@/lib/excel-schemas"
import { importRoster, type ImportRosterSummary } from "@/lib/actions/import-roster"
import { toast } from "sonner"

const now = new Date()

export function ImportRosterDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [summary, setSummary] = useState<ImportRosterSummary | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const reset = () => {
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error("Seleccioná un archivo .xlsx")
      return
    }
    const formData = new FormData()
    formData.set("file", file)
    formData.set("year", year)
    formData.set("month", month)

    startTransition(async () => {
      const res = await importRoster(formData)
      if (res.ok) {
        setSummary(res.summary)
        router.refresh()
      } else {
        toast.error(res.error || "Ocurrió un error al importar")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilla de distritos</DialogTitle>
          <DialogDescription>
            Una fila por congregación. Los distritos, responsables y congregaciones que no existan
            se crean automáticamente.
          </DialogDescription>
        </DialogHeader>

        <ExcelColumnsPreview
          columns={ROSTER_COLUMNS}
          exampleRows={ROSTER_EXAMPLE_ROWS}
          templateHref="/api/export/roster?template=1"
        />
        <p className="text-[11px] text-muted-foreground">
          El responsable se escribe como &ldquo;Apellido Nombre&rdquo;; si el apellido tiene más de
          una palabra y el pastor todavía no está cargado, usá &ldquo;Apellido, Nombre&rdquo;. Tipo
          vacío se toma como Iglesia y Miembros vacío no toca las estadísticas. Lo que no figure en
          el archivo se deja como está: nada se archiva ni se borra.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roster-file">Archivo .xlsx</Label>
            <Input id="roster-file" ref={fileInputRef} type="file" accept=".xlsx" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="roster-month">Mes de la membresía</Label>
              <Input
                id="roster-month"
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roster-year">Año</Label>
              <Input
                id="roster-year"
                type="number"
                min={1900}
                max={now.getFullYear() + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            La planilla no trae fecha: la columna Miembros se guarda como el registro mensual de
            este mes y año.
          </p>

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {summary.districtsCreated} distritos y {summary.pastorsCreated} pastores creados ·{" "}
                {summary.churchesCreated} congregaciones creadas
                {summary.churchesUpdated > 0 && `, ${summary.churchesUpdated} actualizadas`} ·{" "}
                {summary.statsSaved} registros de miembros
                {summary.assignmentsChanged > 0 &&
                  ` · ${summary.assignmentsChanged} asignaciones de pastor`}
                {summary.errorCount > 0 && ` · ${summary.errorCount} filas con error`}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
