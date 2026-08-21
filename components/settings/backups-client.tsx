"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createBackupAction, restoreBackupAction } from "@/lib/actions/backup"
import { logoutAction } from "@/lib/actions/auth"
import type { BackupListEntry } from "@/lib/backup"
import { formatNumber } from "@/lib/format"
import { DatabaseBackup, RotateCcw, TriangleAlert, Plus } from "lucide-react"
import { toast } from "sonner"

const CONFIRM_WORD = "RESTAURAR"

/** Entity counts worth showing per row; the rest are auth plumbing. */
const SUMMARY_KEYS: { key: string; label: string }[] = [
  { key: "districts", label: "distritos" },
  { key: "churches", label: "iglesias" },
  { key: "pastors", label: "pastores" },
  { key: "statisticRecords", label: "registros" },
]

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupsClient({ backups }: { backups: BackupListEntry[] }) {
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<BackupListEntry | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const router = useRouter()

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createBackupAction()
      if (res.ok) {
        toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const openRestore = (backup: BackupListEntry) => {
    setConfirmText("")
    setTarget(backup)
  }

  const handleRestore = () => {
    if (!target || confirmText !== CONFIRM_WORD) return
    startTransition(async () => {
      const res = await restoreBackupAction(target.name)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // The restored database may not contain the user or organization this
      // session's token points at, so the only safe next step is a fresh login.
      toast.success(`${res.message} Cerrando sesión…`)
      setTarget(null)
      await logoutAction()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Backups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La aplicación guarda una copia automática al abrir y al cerrar. Desde acá podés crear
            una copia manual o volver a un punto anterior.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          Crear backup ahora
        </Button>
      </div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="size-4 text-destructive" />
            Restaurar reemplaza toda la base
          </CardTitle>
          <CardDescription>
            No es una fusión: todo lo cargado después de la fecha del backup elegido se pierde.
            Antes de restaurar se guarda automáticamente una copia del estado actual, que queda
            listada acá por si necesitás volver atrás.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="size-4 text-muted-foreground" />
            Puntos de restauración
          </CardTitle>
          <CardDescription>
            {backups.length === 0
              ? "Todavía no hay backups guardados."
              : `${backups.length} ${backups.length === 1 ? "copia disponible" : "copias disponibles"}, de la más reciente a la más antigua.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Creá la primera copia con el botón de arriba.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Contenido</TableHead>
                    <TableHead className="text-right">Tamaño</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.name}>
                      <TableCell>
                        <div className="font-medium">{formatTimestamp(backup.createdAt)}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {backup.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {SUMMARY_KEYS.map(({ key, label }) => (
                            <Badge key={key} variant="secondary" className="font-normal">
                              {formatNumber(backup.counts[key] ?? 0)} {label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatSize(backup.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => openRestore(backup)}
                        >
                          <RotateCcw className="size-3.5" />
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurar la base de datos</DialogTitle>
            <DialogDescription>
              Se va a reemplazar todo el contenido actual por el del backup del{" "}
              <strong>{target ? formatTimestamp(target.createdAt) : ""}</strong>. Todo lo cargado
              después de esa fecha se pierde. Al terminar vas a tener que iniciar sesión de nuevo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-restore">
              Escribí <span className="font-mono font-semibold">{CONFIRM_WORD}</span> para confirmar
            </Label>
            <Input
              id="confirm-restore"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={isPending || confirmText !== CONFIRM_WORD}
            >
              {isPending ? "Restaurando…" : "Restaurar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
