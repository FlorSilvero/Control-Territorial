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
import { createDistrict, updateDistrict } from "@/lib/actions/districts"
import { toast } from "sonner"

export function DistrictDialog({
  open,
  onOpenChange,
  district,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  district?: { id: string; name: string; notes?: string | null } | null
}) {
  const [name, setName] = useState(district?.name ?? "")
  const [notes, setNotes] = useState(district?.notes ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isEditing = !!district

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = isEditing
        ? await updateDistrict(district.id, { name, notes })
        : await createDistrict({ name, notes })

      if (res.ok) {
        toast.success(isEditing ? "Distrito actualizado" : "Distrito creado con éxito")
        onOpenChange(false)
        if (!isEditing) {
          setName("")
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
          <DialogTitle>{isEditing ? "Editar Distrito" : "Crear Distrito"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificá la información del distrito pastoral."
              : "Ingresá los datos para crear un nuevo distrito pastoral."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="district-name">Nombre del distrito *</Label>
            <Input
              id="district-name"
              placeholder="Ej. Distrito Norte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district-notes">Notas / Observaciones</Label>
            <Textarea
              id="district-notes"
              placeholder="Detalles adicionales opcionales..."
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
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear distrito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
