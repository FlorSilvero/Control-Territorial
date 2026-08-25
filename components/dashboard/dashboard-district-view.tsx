import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BaptismsByYearChart } from "@/components/dashboard/dashboard-charts"
import { formatDate, formatDuration } from "@/lib/date-utils"
import { Church, Users, Waves, UserCheck, TrendingUp, ArrowRight } from "lucide-react"
import type { getDistrictDetail } from "@/lib/queries"

type DistrictDetail = NonNullable<Awaited<ReturnType<typeof getDistrictDetail>>>

export function DashboardDistrictView({ data }: { data: DistrictDetail }) {
  const kpis = [
    { title: "Iglesias", value: data.churchCount, icon: Church },
    { title: "Miembros", value: data.totalMembers.toLocaleString("es-AR"), icon: Users },
    { title: "Bautismos este año", value: data.baptismsThisYear, icon: Waves },
    { title: "Bautismos acumulados", value: data.baptismsTotal, icon: Waves },
  ]

  const pastorName = data.currentAssignment
    ? `${data.currentAssignment.pastor.firstName} ${data.currentAssignment.pastor.lastName}`
    : "Sin pastor asignado"

  const yearlyChartData = data.yearly.map((y) => ({ year: String(y.year), baptisms: y.baptisms }))
  const churchesRanked = [...data.churches].sort((a, b) => b.baptismsTotal - a.baptismsTotal)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">{data.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <UserCheck className="size-3.5" />
            Pastor actual: {pastorName}
          </p>
        </div>
        <Link
          href={`/districts/${data.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
        >
          Ver ficha completa
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Icon className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-serif text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Evolución de Bautismos por Año
            </CardTitle>
            <CardDescription>Histórico del distrito.</CardDescription>
          </CardHeader>
          <CardContent>
            <BaptismsByYearChart data={yearlyChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Church className="size-4 text-primary" />
              Iglesias del distrito
            </CardTitle>
            <CardDescription>Ordenadas por bautismos acumulados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {churchesRanked.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin iglesias registradas.</p>
            ) : (
              churchesRanked.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <span className="font-medium">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {c.currentMembers} miembros
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      {c.baptismsTotal} bautismos
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCheck className="size-4 text-emerald-600" />
            Historial de pastores
          </CardTitle>
          <CardDescription>Gestiones registradas en este distrito.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin gestiones registradas.</p>
          ) : (
            data.assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {a.pastor.firstName} {a.pastor.lastName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : "Actualidad"}
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatDuration(a.startDate, a.endDate)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
