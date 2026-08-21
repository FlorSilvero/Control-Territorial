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
  existingRecords = [],
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
  existingRecords?: {
    period: "ANNUAL" | "MONTHLY"
    year: number
    month?: number | null
    memberCount: number
    baptismCount: number
  }[]
}) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Editing a legacy annual record keeps its own period; every new record is
  // always monthly now (yearly totals are just the sum of the monthly ones).
  const isEditingAnnual = initialRecord?.period === "ANNUAL"

  const [year, setYear] = useState<number>(initialRecord?.year ?? currentYear)
  const [month, setMonth] = useState<number>(initialRecord?.month ?? currentMonth)
  const [memberCount, setMemberCount] = useState<number>(initialRecord?.memberCount ?? 0)
  const [baptismCount, setBaptismCount] = useState<number>(initialRecord?.baptismCount ?? 0)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const findMatch = (y: number, m: number) =>
    existingRecords.find((r) => r.period === "MONTHLY" && r.year === y && r.month === m)

  // The dialog element stays mounted across opens (only `open` toggles), so
  // its state has to be re-synced from initialRecord every time it opens —
  // otherwise reopening it for a different record keeps showing whatever was
  // last typed, and saving quietly overwrites that other record. This runs
  // during render rather than in an effect (React's documented "adjust state
  // when a prop changes"), so the re-sync lands before the dialog paints
  // instead of cascading a second render after a stale frame.
  const resetKey = `${open}|${initialRecord?.id ?? "new"}`
  const [syncedKey, setSyncedKey] = useState(resetKey)
  if (resetKey !== syncedKey) {
    setSyncedKey(resetKey)
    if (open) {
      const y = initialRecord?.year ?? currentYear
      const m = isEditingAnnual ? currentMonth : initialRecord?.month ?? currentMonth
      setYear(y)
      setMonth(m)
      const match = isEditingAnnual ? initialRecord : findMatch(y, m) ?? initialRecord
      setMemberCount(match?.memberCount ?? 0)
      setBaptismCount(match?.baptismCount ?? 0)
    }
  }

  // If a monthly record already exists for the selected year/month, surface
  // it so the "existing data loaded" hint below can render.
  const existingMatch = isEditingAnnual ? null : findMatch(year, month)

  const handleYearChange = (newYear: number) => {
    setYear(newYear)
    if (isEditingAnnual) return
    const match = findMatch(newYear, month)
    setMemberCount(match?.memberCount ?? 0)
    setBaptismCount(match?.baptismCount ?? 0)
  }

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth)
    const match = findMatch(year, newMonth)
    setMemberCount(match?.memberCount ?? 0)
    setBaptismCount(match?.baptismCount ?? 0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await upsertStatistic({
        churchId,
        period: isEditingAnnual ? "ANNUAL" : "MONTHLY",
        year: Number(year),
        month: isEditingAnnual ? null : Number(month),
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
            mes. El total anual se calcula automáticamente como la suma de los meses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stat-year">Año *</Label>
              <Input
                id="stat-year"
                type="number"
                min={1900}
                max={currentYear + 1}
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                disabled={isEditingAnnual}
                required
              />
            </div>

            {!isEditingAnnual && (
              <div className="space-y-2">
                <Label htmlFor="stat-month">Mes *</Label>
                <Select
                  value={String(month)}
                  onValueChange={(val) => handleMonthChange(Number(val))}
                  items={Object.fromEntries(MONTH_NAMES.map((name, index) => [String(index + 1), name]))}
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

          {existingMatch && (
            <p className="text-xs rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Ya existe un registro para {MONTH_NAMES[month - 1]} de {year}. Se cargaron sus datos
              — al guardar, se actualiza ese registro en lugar de crear uno nuevo.
            </p>
          )}

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
