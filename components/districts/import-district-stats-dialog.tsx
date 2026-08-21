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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar estadísticas desde Excel</DialogTitle>
          <DialogDescription>
            Una fila por iglesia y mes. Distrito, Iglesia, Año y Mes son obligatorios y deben
            coincidir con registros ya existentes.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border text-xs overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted">
              <tr>
                {["Distrito", "Iglesia", "Año", "Mes", "Miembros", "Bautismos"].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t">
                <td className="px-2 py-1.5">Norte</td>
                <td className="px-2 py-1.5">Central</td>
                <td className="px-2 py-1.5">2026</td>
                <td className="px-2 py-1.5">7</td>
                <td className="px-2 py-1.5">120</td>
                <td className="px-2 py-1.5">3</td>
              </tr>
              <tr className="border-t">
                <td className="px-2 py-1.5">Norte</td>
                <td className="px-2 py-1.5">Central</td>
                <td className="px-2 py-1.5">2026</td>
                <td className="px-2 py-1.5">8</td>
                <td className="px-2 py-1.5"></td>
                <td className="px-2 py-1.5">1</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Si dejás Miembros vacío (como el mes 8 del ejemplo), queda igual que el último valor
          cargado para esa iglesia. Bautismos vacío se guarda como 0.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stats-file">Archivo .xlsx</Label>
            <Input id="stats-file" ref={fileInputRef} type="file" accept=".xlsx,.xls" required />
          </div>

          {summary && (
            <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">
                {summary.saved} registros guardados
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
