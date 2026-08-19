"use client"

import { useEffect, useState, useTransition } from "react"
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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignPastor } from "@/lib/actions/pastors"
import { toast } from "sonner"

export function AssignPastorDialog({
  open,
  onOpenChange,
  defaultPastorId,
  defaultDistrictId,
  pastorOptions,
  districtOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPastorId?: string
  defaultDistrictId?: string
  pastorOptions: { id: string; name: string }[]
  districtOptions: { id: string; name: string }[]
}) {
  const [pastorId, setPastorId] = useState(defaultPastorId ?? "")
  const [districtId, setDistrictId] = useState(defaultDistrictId ?? "")
  const today = new Date().toISOString().split("T")[0]
  const [startDate, setStartDate] = useState(today)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isPastorLocked = Boolean(defaultPastorId)
  const isDistrictLocked = Boolean(defaultDistrictId)

  useEffect(() => {
    if (open) {
      setPastorId(defaultPastorId ?? "")
      setDistrictId(defaultDistrictId ?? "")
      setStartDate(new Date().toISOString().split("T")[0])
    }
  }, [open, defaultPastorId, defaultDistrictId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pastorId) {
      toast.error("Seleccioná un pastor")
      return
    }
    if (!districtId) {
      toast.error("Seleccioná un distrito")
      return
    }
    if (!startDate) {
      toast.error("La fecha de inicio es requerida")
      return
    }

    startTransition(async () => {
      const res = await assignPastor({ pastorId, districtId, startDate })
      if (res.ok) {
        toast.success("Asignación realizada con éxito")
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(res.error || "Error al asignar pastor")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar / Cambiar Pastor de Distrito</DialogTitle>
          <DialogDescription>
            Al reasignar, se cerrará automáticamente la gestión anterior en la fecha especificada y
            se preservará todo el historial previo intacto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-pastor">Pastor *</Label>
            <Select
              value={pastorId}
              onValueChange={setPastorId}
              items={pastorOptions.map((p) => ({ value: p.id, label: p.name }))}
              disabled={isPastorLocked}
            >
              <SelectTrigger id="assign-pastor">
                <SelectValue placeholder="Seleccionar pastor..." />
              </SelectTrigger>
              <SelectContent>
                {pastorOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-district">Distrito Destino *</Label>
            <Select
              value={districtId}
              onValueChange={setDistrictId}
              items={districtOptions.map((d) => ({ value: d.id, label: d.name }))}
              disabled={isDistrictLocked}
            >
              <SelectTrigger id="assign-district">
                <SelectValue placeholder="Seleccionar distrito..." />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-start-date">Fecha de inicio de la nueva gestión *</Label>
            <Input
              id="assign-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
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
              {isPending ? "Asignando..." : "Confirmar reasignación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
