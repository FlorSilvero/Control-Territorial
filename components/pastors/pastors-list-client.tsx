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
import { PastorDialog } from "@/components/pastors/pastor-dialog"
import { AssignPastorDialog } from "@/components/pastors/assign-pastor-dialog"
import { formatDuration, formatDate, tenureInMonths } from "@/lib/date-utils"
import {
  Users,
  MapPinned,
  Plus,
  Search,
  UserCheck,
  Calendar,
  Clock,
  ArrowRight,
  ArrowUpDown,
} from "lucide-react"

type PastorItem = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  archivedAt?: Date | null
  currentDistrict: {
    id: string
    name: string
    since: Date
  } | null
  assignmentCount: number
}

export function PastorsListClient({
  pastors,
  districtOptions,
  pastorOptions,
}: {
  pastors: PastorItem[]
  districtOptions: { id: string; name: string }[]
  pastorOptions: { id: string; name: string }[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedPastorForAssign, setSelectedPastorForAssign] = useState<string | undefined>(undefined)

  const [search, setSearch] = useState("")
  const [tenureFilter, setTenureFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "tenure-desc" | "tenure-asc">("name")

  // Filter
  const filtered = pastors.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase()
    const matchesSearch = fullName.includes(search.toLowerCase())

    if (!matchesSearch) return false

    if (tenureFilter === "all") return true
    if (!p.currentDistrict) return false // No tenure if unassigned

    const months = tenureInMonths(new Date(p.currentDistrict.since), null)

    if (tenureFilter === "lt-1") return months < 12
    if (tenureFilter === "1-3") return months >= 12 && months <= 36
    if (tenureFilter === "3-5") return months > 36 && months <= 60
    if (tenureFilter === "gt-5") return months > 60

    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") {
      return a.lastName.localeCompare(b.lastName)
    }
    const monthsA = a.currentDistrict ? tenureInMonths(new Date(a.currentDistrict.since), null) : -1
    const monthsB = b.currentDistrict ? tenureInMonths(new Date(b.currentDistrict.since), null) : -1

    if (sortBy === "tenure-desc") return monthsB - monthsA
    if (sortBy === "tenure-asc") return monthsA - monthsB
    return 0
  })

  const openAssign = (pastorId?: string) => {
    setSelectedPastorForAssign(pastorId)
    setAssignOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Pastores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión del cuerpo pastoral y su rotación histórica entre distritos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => openAssign()} className="gap-2 shrink-0">
            <UserCheck className="size-4" />
            Asignar a distrito
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <Plus className="size-4" />
            Crear pastor
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pastor por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tenure Filter */}
        <Select value={tenureFilter} onValueChange={setTenureFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <Clock className="size-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tiempo en distrito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo tiempo en distrito</SelectItem>
            <SelectItem value="lt-1">Menos de 1 año</SelectItem>
            <SelectItem value="1-3">1 a 3 años</SelectItem>
            <SelectItem value="3-5">3 a 5 años</SelectItem>
            <SelectItem value="gt-5">Más de 5 años</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Select */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-full sm:w-48">
            <ArrowUpDown className="size-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Ordenar por Apellido</SelectItem>
            <SelectItem value="tenure-desc">Mayor antigüedad</SelectItem>
            <SelectItem value="tenure-asc">Menor antigüedad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid of Pastor Cards */}
      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Users className="size-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg font-semibold">Sin pastores encontrados</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No hay pastores registrados que coincidan con los criterios aplicados.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
            <Plus className="size-4" />
            Crear pastor
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => {
            const fullName = `${p.firstName} ${p.lastName}`
            return (
              <Card key={p.id} className="flex flex-col justify-between hover:border-primary/50 transition-all">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-serif text-xl font-bold flex items-center gap-2">
                        <Users className="size-5 text-primary shrink-0" />
                        <span>{fullName}</span>
                      </CardTitle>
                      {p.currentDistrict ? (
                        <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
                          <MapPinned className="size-3" />
                          {p.currentDistrict.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-muted-foreground">
                          Sin asignación
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {p.currentDistrict ? (
                      <div className="space-y-1.5 rounded-md bg-muted/60 p-3 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3.5" />
                            Inicio:
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDate(p.currentDistrict.since)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            Tiempo en distrito:
                          </span>
                          <span className="font-semibold text-primary">
                            {formatDuration(p.currentDistrict.since, null)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                        Actualmente disponible para asignación.
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Historial de gestiones:</span>
                      <span className="font-semibold text-foreground">
                        {p.assignmentCount} {p.assignmentCount === 1 ? "distrito" : "distritos"}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssign(p.id)}
                      className="flex-1 text-xs"
                    >
                      <UserCheck className="size-3.5 mr-1" />
                      {p.currentDistrict ? "Cambiar distrito" : "Asignar"}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="text-xs">
                      <Link href={`/pastors/${p.id}`}>
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <PastorDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AssignPastorDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        defaultPastorId={selectedPastorForAssign}
        pastorOptions={pastorOptions}
        districtOptions={districtOptions}
      />
    </div>
  )
}
