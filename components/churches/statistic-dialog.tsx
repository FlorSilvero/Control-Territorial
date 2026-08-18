"use client"

import { useState, useTransition } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { upsertStatistic } from "@/lib/actions/statistics"
import { MONTH_NAMES } from "@/lib/date-utils"
import { toast } from "sonner"

export function StatisticDialog({
  open,
  onOpenChange,
  churchId,
  initialRecord,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  churchId: string
  initialRecord?: {
    id?: string
    period: "ANNUAL" | "MONTHLY"
    year: number
    month?: number | null
    memberCount: number
    baptismCount: number
  } | null
}) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [period, setPeriod] = useState<"ANNUAL" | "MONTHLY">(initialRecord?.period ?? "MONTHLY")
  const [year, setYear] = useState<number>(initialRecord?.year ?? currentYear)
  const [month, setMonth] = useState<number>(initialRecord?.month ?? currentMonth)
  const [memberCount, setMemberCount] = useState<number>(initialRecord?.memberCount ?? 0)
  const [baptismCount, setBaptismCount] = useState<number>(initialRecord?.baptismCount ?? 0)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await upsertStatistic({
        churchId,
        period,
        year: Number(year),
        month: period === "MONTHLY" ? Number(month) : null,
        memberCount: Number(memberCount),
        baptismCount: Number(baptismCount),
      })

      if (res.ok) {
        toast.success("Estadística guardada con éxito")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(res.error || "Error al guardar estadística")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar / Editar Estadística</DialogTitle>
          <DialogDescription>
            Ingresá los datos de miembros (fotografía de estado) y bautismos acumulados durante el
            período.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stat-period">Tipo de Registro *</Label>
            <Select
              value={period}
              onValueChange={(val) => setPeriod(val as "ANNUAL" | "MONTHLY")}
            >
              <SelectTrigger id="stat-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensual (Año actual o detallado)</SelectItem>
                <SelectItem value="ANNUAL">Anual (Cierre de año)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stat-year">Año *</Label>
              <Input
                id="stat-year"
                type="number"
                min={1900}
                max={currentYear + 1}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                required
              />
            </div>

            {period === "MONTHLY" && (
              <div className="space-y-2">
                <Label htmlFor="stat-month">Mes *</Label>
                <Select
                  value={String(month)}
                  onValueChange={(val) => setMonth(Number(val))}
                >
                  <SelectTrigger id="stat-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, index) => (
                      <SelectItem key={name} value={String(index + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stat-members">Cantidad de Miembros *</Label>
              <Input
                id="stat-members"
                type="number"
                min={0}
                value={memberCount}
                onChange={(e) => setMemberCount(Number(e.target.value))}
                required
              />
              <p className="text-[10px] text-muted-foreground">Snapshot actual de la iglesia.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stat-baptisms">Bautismos en el Período *</Label>
              <Input
                id="stat-baptisms"
                type="number"
                min={0}
                value={baptismCount}
                onChange={(e) => setBaptismCount(Number(e.target.value))}
                required
              />
              <p className="text-[10px] text-muted-foreground">Flujo acumulado del período.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar registro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
