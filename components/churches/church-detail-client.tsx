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
import { ChurchDialog } from "@/components/churches/church-dialog"
import { StatisticDialog } from "@/components/churches/statistic-dialog"
import { archiveChurch } from "@/lib/actions/churches"
import { deleteStatistic } from "@/lib/actions/statistics"
import { MONTH_NAMES } from "@/lib/date-utils"
import {
  MapPinned,
  Waves,
  Plus,
  Pencil,
  Archive,
  Trash2,
  Calendar,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"
import type { YearlyRow } from "@/lib/queries"

type ChurchDetailData = {
  id: string
  name: string
  address?: string | null
  notes?: string | null
  archivedAt?: Date | null
  district: { id: string; name: string }
  currentPastor: { id: string; firstName: string; lastName: string } | null
  currentMembers: number
  baptismsThisYear: number
  baptismsTotal: number
  statistics: StatisticRow[]
  yearly: YearlyRow[]
}

type StatisticRow = {
  id: string
  period: "ANNUAL" | "MONTHLY"
  year: number
  month?: number | null
  memberCount: number
  baptismCount: number
}

export function ChurchDetailClient({
  church,
  districtOptions,
  canEdit,
}: {
  church: ChurchDetailData
  districtOptions: { id: string; name: string }[]
  /** VIEWER users get a read-only page: the server refuses these actions anyway. */
  canEdit: boolean
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [statOpen, setStatOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<StatisticRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const pastorName = church.currentPastor
    ? `${church.currentPastor.firstName} ${church.currentPastor.lastName}`
    : "Sin pastor"

  const handleArchive = () => {
    if (!confirm(`¿Estás seguro de archivar la iglesia ${church.name}?`)) return
    startTransition(async () => {
      const res = await archiveChurch(church.id)
      if (res.ok) {
        toast.success("Iglesia archivada")
        router.push("/churches")
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleDeleteStat = (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este registro estadístico?")) return
    startTransition(async () => {
      const res = await deleteStatistic(id)
      if (res.ok) {
        toast.success("Registro eliminado")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const openNewStat = () => {
    setEditingRecord(null)
    setStatOpen(true)
  }

  const openEditStat = (rec: StatisticRow) => {
    setEditingRecord(rec)
    setStatOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/churches">Iglesias</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{church.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">{church.name}</h1>
            {church.archivedAt && <Badge variant="destructive">Archivada</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <Link
              href={`/districts/${church.district.id}`}
              className="flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <MapPinned className="size-3.5" />
              {church.district.name}
            </Link>
            {church.address && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {church.address}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" />
              Editar
            </Button>
            <Button size="sm" onClick={openNewStat} className="gap-1.5">
              <Plus className="size-3.5" />
              Registrar estadística
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
        )}
      </div>

      {/* Quick KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Distrito Pastoral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-lg font-bold truncate">{church.district.name}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Distrito al que pertenece</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pastor Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-lg font-bold truncate">{pastorName}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Líder pastoral a cargo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Miembros Actuales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{church.currentMembers}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Último snapshot registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bautismos Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-2xl font-bold">{church.baptismsTotal}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {church.baptismsThisYear} bautismos este año
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Tabs: Yearly vs Monthly breakdown */}
      <Tabs defaultValue="yearly" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="yearly" className="gap-2">
            <Calendar className="size-4" />
            Histórico Anual
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <Waves className="size-4" />
            Desglose Mensual
          </TabsTrigger>
        </TabsList>

        {/* YEARLY TAB */}
        <TabsContent value="yearly" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-lg font-bold">Evolución Histórica por Año</CardTitle>
                <CardDescription>
                  Muestra la cantidad de miembros, bautismos y el pastor a cargo durante cada período anual.
                </CardDescription>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={openNewStat} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Registrar dato
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {church.yearly.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sin registros históricos guardados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Año</TableHead>
                      <TableHead>Pastor Correspondiente</TableHead>
                      <TableHead className="text-right">Miembros (Snapshot)</TableHead>
                      <TableHead className="text-right">Bautismos Acumulados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {church.yearly.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-serif font-bold">{row.year}</TableCell>
                        <TableCell>
                          {row.pastor ? (
                            <span className="font-medium">
                              {row.pastor.firstName} {row.pastor.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Sin pastor</span>
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
        </TabsContent>

        {/* MONTHLY TAB — full editable ledger of every statistic record */}
        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-lg font-bold">Desglose Mensual</CardTitle>
                <CardDescription>
                  Todos los registros ingresados, del más reciente al más antiguo.
                </CardDescription>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={openNewStat} className="gap-1.5">
                  <Plus className="size-3.5" />
                  Registrar mes
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {church.statistics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin registros.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Año / Mes</TableHead>
                      <TableHead className="text-right">Miembros</TableHead>
                      <TableHead className="text-right">Bautismos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {church.statistics.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <Badge variant={rec.period === "ANNUAL" ? "secondary" : "outline"}>
                            {rec.period === "ANNUAL" ? "Anual" : "Mensual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {rec.year}
                          {rec.month ? ` - ${MONTH_NAMES[rec.month - 1]}` : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono">{rec.memberCount}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {rec.baptismCount}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {canEdit && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditStat(rec)}
                                className="size-8"
                              >
                                <Pencil className="size-3.5" />
                                <span className="sr-only">Editar</span>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteStat(rec.id)}
                                className="size-8 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="size-3.5" />
                                <span className="sr-only">Eliminar</span>
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ChurchDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        church={{ ...church, districtId: church.district.id }}
        districtOptions={districtOptions}
      />

      <StatisticDialog
        open={statOpen}
        onOpenChange={setStatOpen}
        churchId={church.id}
        initialRecord={editingRecord}
        existingRecords={church.statistics}
      />
    </div>
  )
}
