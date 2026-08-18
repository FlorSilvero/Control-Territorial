"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PastorDialog } from "@/components/pastors/pastor-dialog"
import { AssignPastorDialog } from "@/components/pastors/assign-pastor-dialog"
import { archivePastor } from "@/lib/actions/pastors"
import { formatDate, formatDuration, MONTH_NAMES } from "@/lib/date-utils"
import {
  Users,
  MapPinned,
  UserCheck,
  Pencil,
  Archive,
  Mail,
  Phone,
  Calendar,
  Clock,
  Waves,
} from "lucide-react"
import { toast } from "sonner"

type PastorDetailData = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  archivedAt?: Date | null
  currentDistrict: {
    id: string
    name: string
    since: Date
  } | null
  assignments: {
    id: string
    district: { id: string; name: string }
    startDate: Date
    endDate: Date | null
    baptisms: number
    currentYearMonthly: { month: number; baptisms: number }[] | null
  }[]
}

export function PastorDetailClient({
  pastor,
  districtOptions,
  pastorOptions,
}: {
  pastor: PastorDetailData
  districtOptions: { id: string; name: string }[]
  pastorOptions: { id: string; name: string }[]
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const fullName = `${pastor.firstName} ${pastor.lastName}`

  const handleArchive = () => {
    if (!confirm(`¿Estás seguro de archivar al pastor ${fullName}?`)) return
    startTransition(async () => {
      const res = await archivePastor(pastor.id)
      if (res.ok) {
        toast.success("Pastor archivado")
        router.push("/pastors")
      } else {
        toast.error(res.error)
      }
    })
  }

  const totalBaptismsAcrossTenures = pastor.assignments.reduce((acc, a) => acc + a.baptisms, 0)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/pastors">Pastores</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">{fullName}</h1>
            {pastor.archivedAt && <Badge variant="destructive">Archivado</Badge>}
            {pastor.currentDistrict ? (
              <Badge variant="secondary" className="gap-1">
                <MapPinned className="size-3" />
                {pastor.currentDistrict.name}
              </Badge>
            ) : (
              <Badge variant="outline">Sin asignación activa</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            {pastor.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {pastor.email}
              </span>
            )}
            {pastor.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {pastor.phone}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="size-3.5" />
            Editar
          </Button>
          <Button size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
            <UserCheck className="size-3.5" />
            {pastor.currentDistrict ? "Cambiar distrito" : "Asignar a distrito"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            disabled={isPending}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Archive className="size-3.5" />
            Archivar
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Distrito Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-xl font-bold">
              {pastor.currentDistrict ? pastor.currentDistrict.name : "Sin asignación"}
            </div>
            {pastor.currentDistrict ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                Desde {formatDate(pastor.currentDistrict.since)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Disponible</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tiempo en Distrito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-xl font-bold">
              {pastor.currentDistrict
                ? formatDuration(pastor.currentDistrict.since, null)
                : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="size-3" />
              Gestión activa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Bautismos Acumulados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{totalBaptismsAcrossTenures}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Durante todas sus gestiones</p>
          </CardContent>
        </Card>
      </div>

      {/* HISTORIAL DEL PASTOR (ASSIGNMENTS CHRONOLOGY) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl font-bold">Historial de Asignaciones y Gestiones</CardTitle>
          <CardDescription>
            Trazabilidad inmutable de distritos liderados por el pastor y bautismos ocurridos durante cada período.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pastor.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin historial de asignaciones.
            </p>
          ) : (
            <div className="space-y-6">
              {pastor.assignments.map((a) => {
                const isActive = a.endDate === null
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden"
                  >
                    {isActive && (
                      <div className="absolute top-0 right-0 rounded-bl bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        Gestión Activa
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-16">
                      <div className="flex items-center gap-2">
                        <MapPinned className="size-5 text-primary" />
                        <Link
                          href={`/districts/${a.district.id}`}
                          className="font-serif text-lg font-bold hover:underline"
                        >
                          {a.district.name}
                        </Link>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="size-3.5" />
                        <span>
                          {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : "Actualidad"}
                        </span>
                        <Badge variant="outline" className="ml-1">
                          {formatDuration(a.startDate, a.endDate)}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats during tenure */}
                    <div className="flex items-center gap-4 rounded-md bg-muted/50 p-3 text-sm">
                      <Waves className="size-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground">Bautismos durante esta gestión: </span>
                        <span className="font-serif font-bold text-base">{a.baptisms}</span>
                      </div>
                    </div>

                    {/* Current Year Monthly Breakdown if active tenure */}
                    {isActive && a.currentYearMonthly && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Bautismos por mes ({new Date().getFullYear()}):
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                          {a.currentYearMonthly.map((m) => (
                            <div
                              key={m.month}
                              className="rounded border p-2 text-center bg-background"
                            >
                              <div className="text-[10px] text-muted-foreground">
                                {MONTH_NAMES[m.month - 1].slice(0, 3)}
                              </div>
                              <div className="font-serif font-bold text-sm">{m.baptisms}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PastorDialog open={editOpen} onOpenChange={setEditOpen} pastor={pastor} />

      <AssignPastorDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        defaultPastorId={pastor.id}
        pastorOptions={pastorOptions}
        districtOptions={districtOptions}
      />
    </div>
  )
}
