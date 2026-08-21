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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar pastores desde Excel</DialogTitle>
          <DialogDescription>
            El archivo .xlsx debe tener estas columnas en la primera fila. Nombre y Apellido son
            obligatorios; el resto es opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border text-xs overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted">
              <tr>
                {["Nombre", "Apellido", "Email", "Teléfono", "Distrito", "Fecha inicio", "Notas"].map(
                  (h) => (
                    <th key={h} className="px-2 py-1.5 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t">
                <td className="px-2 py-1.5">Juan</td>
                <td className="px-2 py-1.5">Pérez</td>
                <td className="px-2 py-1.5">juan@iglesia.app</td>
                <td className="px-2 py-1.5">+54 9 11 1234-5678</td>
                <td className="px-2 py-1.5">Norte</td>
                <td className="px-2 py-1.5">2026-01-15</td>
                <td className="px-2 py-1.5"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Un pastor existente (mismo Nombre + Apellido) se actualiza en vez de duplicarse. Si
          completás Distrito, se asigna al pastor desde la Fecha inicio indicada (o desde hoy si se
          deja vacía).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pastors-file">Archivo .xlsx</Label>
            <Input id="pastors-file" ref={fileInputRef} type="file" accept=".xlsx,.xls" required />
          </div>

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {summary.created} creados · {summary.updated} actualizados · {summary.assigned}{" "}
                asignados a distrito
                {summary.errors.length > 0 && ` · ${summary.errors.length} con error`}
              </p>
              {summary.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-destructive">
                  {summary.errors.map((err, i) => (
                    <li key={i}>
                      Fila {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
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
