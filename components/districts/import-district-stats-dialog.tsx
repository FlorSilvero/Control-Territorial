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
import { STATISTIC_COLUMNS, STATISTIC_EXAMPLE_ROWS } from "@/lib/excel-schemas"
import {
  importDistrictStatistics,
  type ImportStatisticsSummary,
} from "@/lib/actions/import-statistics"
import { toast } from "sonner"

export function ImportDistrictStatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<ImportStatisticsSummary | null>(null)
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

    startTransition(async () => {
      const res = await importDistrictStatistics(formData)
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
          <DialogTitle>Importar estadísticas desde Excel</DialogTitle>
          <DialogDescription>
            Una fila por iglesia y mes. Distrito e Iglesia deben coincidir con registros ya
            existentes en la app.
          </DialogDescription>
        </DialogHeader>

        <ExcelColumnsPreview
          columns={STATISTIC_COLUMNS}
          exampleRows={STATISTIC_EXAMPLE_ROWS}
          templateHref="/api/export/statistics?template=1"
        />
        <p className="text-[11px] text-muted-foreground">
          Si dejás Miembros vacío (como el mes 8 del ejemplo), queda igual que el último valor
          conocido de esa iglesia hasta ese mes. Bautismos vacío se guarda como 0. Un mes que ya
          existe se reemplaza con lo que traiga el archivo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stats-file">Archivo .xlsx</Label>
            <Input id="stats-file" ref={fileInputRef} type="file" accept=".xlsx" required />
          </div>

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {summary.saved} registros guardados
                {summary.errorCount > 0 && ` · ${summary.errorCount} con error`}
              </p>
              <ImportErrorList errors={summary.errors} errorCount={summary.errorCount} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
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
