"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DistrictDialog } from "@/components/districts/district-dialog"
import { ChurchDialog } from "@/components/churches/church-dialog"
import { AssignPastorDialog } from "@/components/pastors/assign-pastor-dialog"
import { archiveDistrict } from "@/lib/actions/districts"
import { formatDate, formatDuration, MONTH_NAMES } from "@/lib/date-utils"
import {
  MapPinned,
  Church,
  Users,
  Waves,
  UserCheck,
  Plus,
  Pencil,
  Archive,
  Calendar,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import type { YearlyRow, MonthlyRow } from "@/lib/queries"

type DetailData = {
  id: string
  name: string
  notes?: string | null
  archivedAt?: Date | null
  churchCount: number
  totalMembers: number
  baptismsThisYear: number
  baptismsTotal: number
  currentAssignment: {
    id: string
    startDate: Date
    pastor: {
      id: string
      firstName: string
      lastName: string
    }
  } | null
  churches: {
    id: string
    name: string
    currentMembers: number
    baptismsThisYear: number
    baptismsTotal: number
  }[]
  assignments: {
    id: string
    startDate: Date
    endDate: Date | null
    pastor: {
      id: string
      firstName: string
      lastName: string
    }
  }[]
  yearly: YearlyRow[]
  monthly: MonthlyRow[]
}

export function DistrictDetailClient({
  district,
  districtOptions,
  pastorOptions,
}: {
  district: DetailData
  districtOptions: { id: string; name: string }[]
  pastorOptions: { id: string; name: string }[]
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [churchCreateOpen, setChurchCreateOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const currentPastorName = district.currentAssignment
    ? `${district.currentAssignment.pastor.firstName} ${district.currentAssignment.pastor.lastName}`
    : "Sin pastor"

  const handleArchive = () => {
    if (!confirm(`¿Estás seguro de archivar el distrito ${district.name}?`)) return
    startTransition(async () => {
      const res = await archiveDistrict(district.id)
      if (res.ok) {
        toast.success("Distrito archivado")
        router.push("/districts")
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/districts">Distritos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{district.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">{district.name}</h1>
            {district.archivedAt && <Badge variant="destructive">Archivado</Badge>}
          </div>
          {district.notes && (
            <p className="text-sm text-muted-foreground mt-1">{district.notes}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="size-3.5" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
            <UserCheck className="size-3.5" />
            Asignar pastor
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pastor Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-lg font-bold truncate">{currentPastorName}</div>
            {district.currentAssignment ? (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="size-3" />
                Desde {formatDate(district.currentAssignment.startDate)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Sin asignación activa</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tiempo Transcurrido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-lg font-bold">
              {district.currentAssignment
                ? formatDuration(district.currentAssignment.startDate, null)
                : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="size-3" />
              Gestión actual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Iglesias Pertenecientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{district.churchCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Iglesias activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Miembros Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{district.totalMembers}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Suma de iglesias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bautismos Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{district.baptismsTotal}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {district.baptismsThisYear} este año
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs (Iglesias & Histórico) */}
      <Tabs defaultValue="churches" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="churches" className="gap-2">
            <Church className="size-4" />
            Iglesias ({district.churchCount})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Calendar className="size-4" />
            Evolución Histórica
          </TabsTrigger>
        </TabsList>

        {/* SECTION 1: IGLESIAS */}
        <TabsContent value="churches" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Iglesias del Distrito</h2>
            <Button size="sm" onClick={() => setChurchCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Crear iglesia
            </Button>
          </div>

          {district.churches.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No hay iglesias pertenecientes a este distrito.
              </p>
              <Button size="sm" variant="outline" onClick={() => setChurchCreateOpen(true)} className="mt-4 gap-1.5">
                <Plus className="size-4" />
                Agregar la primera iglesia
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {district.churches.map((c) => (
                <Card key={c.id} className="flex flex-col justify-between hover:border-primary/50 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg font-semibold flex items-center gap-2">
                      <Church className="size-4 text-primary shrink-0" />
                      <Link href={`/churches/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm py-1 border-b">
                      <span className="text-muted-foreground">Distrito:</span>
                      <span className="font-medium">{district.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b">
                      <span className="text-muted-foreground">Pastor actual:</span>
                      <span className="font-medium">{currentPastorName}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1 border-b">
                      <span className="text-muted-foreground">Miembros actuales:</span>
                      <Badge variant="secondary">{c.currentMembers}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1">
                      <span className="text-muted-foreground">Bautismos año:</span>
                      <Badge variant="outline">{c.baptismsThisYear}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SECTION 2: HISTORIAL DEL DISTRITO */}
        <TabsContent value="history" className="space-y-6">
          {/* Yearly Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">Evolución Anual</CardTitle>
              <CardDescription>
                Resumen de miembros, bautismos y el pastor a cargo durante cada año histórico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {district.yearly.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin registros históricos disponibles.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Año</TableHead>
                      <TableHead>Pastor Responsable</TableHead>
                      <TableHead className="text-right">Miembros Totales</TableHead>
                      <TableHead className="text-right">Bautismos en el Año</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {district.yearly.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-serif font-bold">{row.year}</TableCell>
                        <TableCell>
                          {row.pastor ? (
                            <span className="font-medium">
                              {row.pastor.firstName} {row.pastor.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Sin pastor asignado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.members}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {row.baptisms}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Current Year Monthly Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">
                Desglose Mensual (Año en Curso)
              </CardTitle>
              <CardDescription>
                Información mes a mes del año actual para seguimiento activo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {district.monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin registros mensuales para el año actual.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Pastor Responsable</TableHead>
                      <TableHead className="text-right">Miembros</TableHead>
                      <TableHead className="text-right">Bautismos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {district.monthly.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">
                          {MONTH_NAMES[row.month - 1]}
                        </TableCell>
                        <TableCell>
                          {row.pastor ? (
                            <span>
                              {row.pastor.firstName} {row.pastor.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Sin pastor</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{row.members}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {row.baptisms}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Chronological Assignment History */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">Historial de Pastores</CardTitle>
              <CardDescription>
                Cronología inmutable de pastores asignados a este distrito.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {district.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin historial de pastores.
                </p>
              ) : (
                <div className="relative border-l pl-6 space-y-6 ml-2 my-2">
                  {district.assignments.map((a) => {
                    const isActive = a.endDate === null
                    return (
                      <div key={a.id} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1 size-3.5 rounded-full border-2 bg-background ${
                            isActive ? "border-primary bg-primary" : "border-muted-foreground"
                          }`}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-medium text-base">
                            {a.pastor.firstName} {a.pastor.lastName}
                          </span>
                          {isActive ? (
                            <Badge variant="default" className="w-fit">
                              Actualmente en gestión
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit text-muted-foreground">
                              {formatDuration(a.startDate, a.endDate)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : "Actualidad"}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DistrictDialog open={editOpen} onOpenChange={setEditOpen} district={district} />

      <ChurchDialog
        open={churchCreateOpen}
        onOpenChange={setChurchCreateOpen}
        defaultDistrictId={district.id}
        districtOptions={districtOptions}
      />

      <AssignPastorDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        defaultDistrictId={district.id}
        initialPastorId={district.currentAssignment?.pastor.id}
        pastorOptions={pastorOptions}
        districtOptions={districtOptions}
      />
    </div>
  )
}
