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
import { createPastor, updatePastor } from "@/lib/actions/pastors"
import { toast } from "sonner"

export function PastorDialog({
  open,
  onOpenChange,
  pastor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pastor?: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    notes?: string | null
  } | null
}) {
  const [firstName, setFirstName] = useState(pastor?.firstName ?? "")
  const [lastName, setLastName] = useState(pastor?.lastName ?? "")
  const [email, setEmail] = useState(pastor?.email ?? "")
  const [phone, setPhone] = useState(pastor?.phone ?? "")
  const [notes, setNotes] = useState(pastor?.notes ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isEditing = !!pastor

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = isEditing
        ? await updatePastor(pastor.id, { firstName, lastName, email, phone, notes })
        : await createPastor({ firstName, lastName, email, phone, notes })

      if (res.ok) {
        toast.success(isEditing ? "Pastor actualizado" : "Pastor creado con éxito")
        onOpenChange(false)
        if (!isEditing) {
          setFirstName("")
          setLastName("")
          setEmail("")
          setPhone("")
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
          <DialogTitle>{isEditing ? "Editar Pastor" : "Crear Pastor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificá la información personal del pastor."
              : "Ingresá los datos para registrar un nuevo pastor."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pastor-firstname">Nombre *</Label>
              <Input
                id="pastor-firstname"
                placeholder="Ej. Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pastor-lastname">Apellido *</Label>
              <Input
                id="pastor-lastname"
                placeholder="Ej. Pérez"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                minLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pastor-email">Correo Electrónico</Label>
              <Input
                id="pastor-email"
                type="email"
                placeholder="ejemplo@iglesia.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pastor-phone">Teléfono / Celular</Label>
              <Input
                id="pastor-phone"
                placeholder="+54 9..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pastor-notes">Notas / Observaciones</Label>
            <Textarea
              id="pastor-notes"
              placeholder="Detalles u observaciones opcionales..."
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
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear pastor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
