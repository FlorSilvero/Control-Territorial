"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DashboardGlobalView } from "@/components/dashboard/dashboard-global-view"
import { DashboardDistrictView } from "@/components/dashboard/dashboard-district-view"
import { DashboardPastorView } from "@/components/dashboard/dashboard-pastor-view"
import { DashboardChurchView } from "@/components/dashboard/dashboard-church-view"
import { getDashboardScopeData, type DashboardScope } from "@/lib/actions/dashboard"
import { X } from "lucide-react"
import type { getDashboardData, getDistrictDetail, getPastorDetail, getChurchDetail } from "@/lib/queries"

type ScopeType = "all" | DashboardScope
type ScopeData =
  | { scope: "district"; data: NonNullable<Awaited<ReturnType<typeof getDistrictDetail>>> }
  | { scope: "pastor"; data: NonNullable<Awaited<ReturnType<typeof getPastorDetail>>> }
  | { scope: "church"; data: NonNullable<Awaited<ReturnType<typeof getChurchDetail>>> }

export function DashboardClient({
  initialData,
  districtOptions,
  pastorOptions,
  churchOptions,
}: {
  initialData: Awaited<ReturnType<typeof getDashboardData>>
  districtOptions: { id: string; name: string }[]
  pastorOptions: { id: string; name: string }[]
  churchOptions: { id: string; name: string; district: string }[]
}) {
  const [scope, setScope] = useState<ScopeType>("all")
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [scopeData, setScopeData] = useState<ScopeData | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(type: DashboardScope, value: string | null) {
    if (!value || value === "all") {
      handleReset()
      return
    }
    setScope(type)
    setScopeId(value)
    setScopeData(null)
    startTransition(async () => {
      const data = await getDashboardScopeData(type, value)
      if (!data) {
        setScopeData(null)
        return
      }
      setScopeData({ scope: type, data } as ScopeData)
    })
  }

  function handleReset() {
    setScope("all")
    setScopeId(null)
    setScopeData(null)
  }

  const hasFilter = scope !== "all"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Dashboard General</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen global de distritos, iglesias, miembros y estadísticas de bautismos. Elegí un
          pastor, distrito o iglesia para ver su resumen puntual.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select
          value={scope === "district" ? (scopeId ?? "all") : "all"}
          onValueChange={(value) => handleSelect("district", value)}
          items={{
            all: "Todos los distritos",
            ...Object.fromEntries(districtOptions.map((d) => [d.id, d.name])),
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
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

        <Select
          value={scope === "pastor" ? (scopeId ?? "all") : "all"}
          onValueChange={(value) => handleSelect("pastor", value)}
          items={{
            all: "Todos los pastores",
            ...Object.fromEntries(pastorOptions.map((p) => [p.id, p.name])),
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todos los pastores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los pastores</SelectItem>
            {pastorOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={scope === "church" ? (scopeId ?? "all") : "all"}
          onValueChange={(value) => handleSelect("church", value)}
          items={{
            all: "Todas las iglesias",
            ...Object.fromEntries(churchOptions.map((c) => [c.id, `${c.name} (${c.district})`])),
          }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todas las iglesias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las iglesias</SelectItem>
            {churchOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.district})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <X className="size-3.5" />
            Vista general
          </Button>
        )}
      </div>

      {/* Content */}
      {scope === "all" && <DashboardGlobalView data={initialData} />}

      {hasFilter && isPending && (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Cargando resumen…
        </div>
      )}

      {hasFilter && !isPending && scopeData?.scope === "district" && (
        <DashboardDistrictView data={scopeData.data} />
      )}
      {hasFilter && !isPending && scopeData?.scope === "pastor" && (
        <DashboardPastorView data={scopeData.data} />
      )}
      {hasFilter && !isPending && scopeData?.scope === "church" && (
        <DashboardChurchView data={scopeData.data} />
      )}
      {hasFilter && !isPending && !scopeData && (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No se encontraron datos para esta selección.
        </div>
      )}
    </div>
  )
}
