import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BaptismsByYearChart } from "@/components/dashboard/dashboard-charts"
import { MONTH_NAMES } from "@/lib/date-utils"
import { MapPinned, Users, Waves, UserCheck, TrendingUp, ArrowRight, ListTree } from "lucide-react"
import type { getChurchDetail } from "@/lib/queries"

type ChurchDetail = NonNullable<Awaited<ReturnType<typeof getChurchDetail>>>

export function DashboardChurchView({ data }: { data: ChurchDetail }) {
  const currentYear = new Date().getFullYear()
  const kpis = [
    { title: "Miembros actuales", value: data.currentMembers.toLocaleString("es-AR"), icon: Users },
    { title: `Bautismos acumulados ${currentYear}`, value: data.baptismsThisYear, icon: Waves },
    { title: "Distrito", value: data.district.name, icon: MapPinned },
  ]

  const pastorName = data.currentPastor
    ? `${data.currentPastor.firstName} ${data.currentPastor.lastName}`
    : "Sin pastor asignado"

  const yearlyChartData = data.yearly.map((y) => ({ year: String(y.year), baptisms: y.baptisms }))
  const recentStats = data.statistics.slice(0, 8)

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
          href={`/churches/${data.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
        >
          Ver ficha completa
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <CardDescription>Histórico de la iglesia.</CardDescription>
          </CardHeader>
          <CardContent>
            <BaptismsByYearChart data={yearlyChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ListTree className="size-4 text-primary" />
              Últimos registros estadísticos
            </CardTitle>
            <CardDescription>Miembros y bautismos por período cargado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentStats.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin registros cargados.</p>
            ) : (
              recentStats.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <span className="font-medium">
                    {s.month ? `${MONTH_NAMES[s.month - 1]} ${s.year}` : `Anual ${s.year}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {s.memberCount} miembros
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      {s.baptismCount} bautismos
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
