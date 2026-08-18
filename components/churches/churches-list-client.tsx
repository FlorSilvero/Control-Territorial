"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChurchDialog } from "@/components/churches/church-dialog"
import { Church, MapPinned, Users, Waves, UserCheck, Plus, Search, ArrowRight } from "lucide-react"

type ChurchItem = {
  id: string
  name: string
  district: { id: string; name: string }
  currentPastor: { id: string; firstName: string; lastName: string } | null
  currentMembers: number
  baptismsThisYear: number
  baptismsTotal: number
}

export function ChurchesListClient({
  churches,
  districtOptions,
}: {
  churches: ChurchItem[]
  districtOptions: { id: string; name: string }[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all")

  const filteredChurches = churches.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesDistrict =
      selectedDistrict === "all" || c.district.id === selectedDistrict
    return matchesSearch && matchesDistrict
  })

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Iglesias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de congregaciones locales y sus estadísticas de miembros y bautismos.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="size-4" />
          Crear iglesia
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar iglesia por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos los distritos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los distritos</SelectItem>
            {districtOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid of Cards */}
      {filteredChurches.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Church className="size-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg font-semibold">Sin resultados</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No se encontraron iglesias que coincidan con los filtros de búsqueda.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
            <Plus className="size-4" />
            Crear iglesia
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChurches.map((c) => {
            const pastorName = c.currentPastor
              ? `${c.currentPastor.firstName} ${c.currentPastor.lastName}`
              : "Sin pastor"

            return (
              <Card key={c.id} className="flex flex-col justify-between hover:border-primary/50 transition-all">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-serif text-xl font-bold flex items-center gap-2">
                        <Church className="size-5 text-primary shrink-0" />
                        <span>{c.name}</span>
                      </CardTitle>
                      <Badge variant="outline" className="shrink-0 flex items-center gap-1">
                        <MapPinned className="size-3" />
                        {c.district.name}
                      </Badge>
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

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-md border p-2.5">
                        <div className="flex justify-center text-muted-foreground mb-1">
                          <Users className="size-4" />
                        </div>
                        <div className="font-serif font-bold text-lg">{c.currentMembers}</div>
                        <div className="text-[11px] text-muted-foreground">Miembros actuales</div>
                      </div>

                      <div className="rounded-md border p-2.5">
                        <div className="flex justify-center text-muted-foreground mb-1">
                          <Waves className="size-4" />
                        </div>
                        <div className="font-serif font-bold text-lg">{c.baptismsThisYear}</div>
                        <div className="text-[11px] text-muted-foreground">Bautismos este año</div>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t">
                  <Button asChild variant="ghost" className="w-full justify-between text-xs font-semibold">
                    <Link href={`/churches/${c.id}`}>
                      <span>Ver detalles de la iglesia</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog for creating church */}
      <ChurchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        districtOptions={districtOptions}
      />
    </div>
  )
}
