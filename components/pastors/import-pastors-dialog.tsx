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
import { PASTOR_COLUMNS, PASTOR_EXAMPLE_ROWS } from "@/lib/excel-schemas"
import { importPastors, type ImportPastorsSummary } from "@/lib/actions/import-pastors"
import { toast } from "sonner"

export function ImportPastorsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<ImportPastorsSummary | null>(null)
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
      const res = await importPastors(formData)
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
          <DialogTitle>Importar pastores desde Excel</DialogTitle>
          <DialogDescription>
            Una fila por pastor. El archivo .xlsx debe tener estas columnas en la primera fila.
          </DialogDescription>
        </DialogHeader>

        <ExcelColumnsPreview
          columns={PASTOR_COLUMNS}
          exampleRows={PASTOR_EXAMPLE_ROWS}
          templateHref="/api/export/pastors?template=1"
        />
        <p className="text-[11px] text-muted-foreground">
          Un pastor existente (mismo Nombre + Apellido) se actualiza en vez de duplicarse, y las
          celdas vacías no borran lo que ya está cargado. Si completás Distrito, se asigna al pastor
          desde la Fecha inicio indicada (o desde hoy si se deja vacía).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pastors-file">Archivo .xlsx</Label>
            <Input id="pastors-file" ref={fileInputRef} type="file" accept=".xlsx" required />
          </div>

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {summary.created} creados · {summary.updated} actualizados · {summary.assigned}{" "}
                asignados a distrito
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
