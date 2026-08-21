"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DistrictDialog } from "@/components/districts/district-dialog"
import { ImportDistrictStatsDialog } from "@/components/districts/import-district-stats-dialog"
import { MapPinned, Church, Users, Waves, UserCheck, Plus, Upload, Download } from "lucide-react"

type DistrictItem = {
  id: string
  name: string
  notes?: string | null
  churchCount: number
  totalMembers: number
  baptismsThisYear: number
  baptismsTotal: number
  currentPastor: {
    id: string
    firstName: string
    lastName: string
    since: Date
  } | null
}

export function DistrictsListClient({
  districts,
  canEdit,
}: {
  districts: DistrictItem[]
  /** VIEWER users get a read-only page: the server refuses these actions anyway. */
  canEdit: boolean
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Distritos Pastorales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de zonas geográficas pastorales y sus iglesias asignadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/api/export/statistics" />}
            className="gap-2 shrink-0"
          >
            <Download className="size-4" />
            Exportar estadísticas
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2 shrink-0">
                <Upload className="size-4" />
                Importar estadísticas
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
                <Plus className="size-4" />
                Crear distrito
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid of Cards */}
      {districts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <MapPinned className="size-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg font-semibold">No hay distritos creados</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Comenzá creando tu primer distrito pastoral para organizar las iglesias y pastores.
          </p>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
              <Plus className="size-4" />
              Crear distrito
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {districts.map((d) => {
            const pastorName = d.currentPastor
              ? `${d.currentPastor.firstName} ${d.currentPastor.lastName}`
              : "Sin pastor"

            return (
              <Card key={d.id} className="flex flex-col justify-between hover:border-primary/50 transition-all">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-serif text-xl font-bold flex items-center gap-2">
                        <MapPinned className="size-5 text-primary shrink-0" />
                        <Link href={`/districts/${d.id}`} className="hover:underline">
                          {d.name}
                        </Link>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Current Pastor Info */}
                    <div className="flex items-center gap-2.5 rounded-md bg-muted/60 p-2.5 text-sm">
                      <UserCheck className="size-4 text-primary shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Pastor actual</span>
                        <span className="font-medium">{pastorName}</span>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="rounded-md border p-2">
                        <div className="flex justify-center text-muted-foreground mb-1">
                          <Church className="size-3.5" />
                        </div>
                        <div className="font-serif font-bold text-base">{d.churchCount}</div>
                        <div className="text-[10px] text-muted-foreground">Iglesias</div>
                      </div>

                      <div className="rounded-md border p-2">
                        <div className="flex justify-center text-muted-foreground mb-1">
                          <Users className="size-3.5" />
                        </div>
                        <div className="font-serif font-bold text-base">{d.totalMembers}</div>
                        <div className="text-[10px] text-muted-foreground">Miembros</div>
                      </div>

                      <div className="rounded-md border p-2">
                        <div className="flex justify-center text-muted-foreground mb-1">
                          <Waves className="size-3.5" />
                        </div>
                        <div className="font-serif font-bold text-base">{d.baptismsThisYear}</div>
                        <div className="text-[10px] text-muted-foreground">Bautismos año</div>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <DistrictDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportDistrictStatsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
