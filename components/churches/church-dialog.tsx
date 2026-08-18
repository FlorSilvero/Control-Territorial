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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createChurch, updateChurch } from "@/lib/actions/churches"
import { toast } from "sonner"

export function ChurchDialog({
  open,
  onOpenChange,
  church,
  defaultDistrictId,
  districtOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  church?: { id: string; name: string; districtId: string; address?: string | null; notes?: string | null } | null
  defaultDistrictId?: string
  districtOptions: { id: string; name: string }[]
}) {
  const [name, setName] = useState(church?.name ?? "")
  const [districtId, setDistrictId] = useState(church?.districtId ?? defaultDistrictId ?? "")
  const [address, setAddress] = useState(church?.address ?? "")
  const [notes, setNotes] = useState(church?.notes ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isEditing = !!church

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!districtId) {
      toast.error("Seleccioná un distrito")
      return
    }

    startTransition(async () => {
      const res = isEditing
        ? await updateChurch(church.id, { name, districtId, address, notes })
        : await createChurch({ name, districtId, address, notes })

      if (res.ok) {
        toast.success(isEditing ? "Iglesia actualizada" : "Iglesia creada con éxito")
        onOpenChange(false)
        if (!isEditing) {
          setName("")
          setAddress("")
          setNotes("")
        }
        router.refresh()
      } else {
        toast.error(res.error || "Ocurrió un error")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Iglesia" : "Crear Iglesia"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificá la información de la iglesia."
              : "Ingresá los datos para registrar una nueva iglesia."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="church-name">Nombre de la iglesia *</Label>
            <Input
              id="church-name"
              placeholder="Ej. Iglesia Central"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="church-district">Distrito asignado *</Label>
            <Select value={districtId} onValueChange={setDistrictId}>
              <SelectTrigger id="church-district">
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
            <Label htmlFor="church-address">Dirección</Label>
            <Input
              id="church-address"
              placeholder="Ej. Av. Principal 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="church-notes">Notas / Observaciones</Label>
            <Textarea
              id="church-notes"
              placeholder="Notas opcionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear iglesia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
