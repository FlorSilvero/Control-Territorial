"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DistrictDialog } from "@/components/districts/district-dialog"
import { MapPinned, Church, Users, Waves, UserCheck, Plus, ArrowRight } from "lucide-react"

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

export function DistrictsListClient({ districts }: { districts: DistrictItem[] }) {
  const [createOpen, setCreateOpen] = useState(false)

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
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="size-4" />
          Crear distrito
        </Button>
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
          <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
            <Plus className="size-4" />
            Crear distrito
          </Button>
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
                        <span>{d.name}</span>
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

                <CardFooter className="pt-3 border-t">
                  <Button asChild variant="ghost" className="w-full justify-between text-xs font-semibold">
                    <Link href={`/districts/${d.id}`}>
                      <span>Ver detalles</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog for creating a district */}
      <DistrictDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
