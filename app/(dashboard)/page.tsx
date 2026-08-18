import { requireSession } from "@/lib/session"
import { getDashboardData } from "@/lib/queries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BaptismsByYearChart,
  BaptismsByMonthChart,
  MembersByDistrictChart,
} from "@/components/dashboard/dashboard-charts"
import { MapPinned, Church, Users, UserCheck, Waves, Trophy, TrendingUp } from "lucide-react"
import Link from "next/link"

export const revalidate = 0

export default async function DashboardPage() {
  const session = await requireSession()
  const data = await getDashboardData(session.organizationId)

  const kpis = [
    {
      title: "Distritos Pastorales",
      value: data.kpis.districts,
      icon: MapPinned,
      description: "Distritos activos",
      href: "/districts",
    },
    {
      title: "Iglesias",
      value: data.kpis.churches,
      icon: Church,
      description: "Iglesias registradas",
      href: "/churches",
    },
    {
      title: "Pastores",
      value: data.kpis.pastors,
      icon: UserCheck,
      description: "Pastores en nómina",
      href: "/pastors",
    },
    {
      title: "Miembros Totales",
      value: data.kpis.members.toLocaleString("es-AR"),
      icon: Users,
      description: "Snapshot más reciente",
      href: "/churches",
    },
    {
      title: "Bautismos Acumulados",
      value: data.kpis.baptisms.toLocaleString("es-AR"),
      icon: Waves,
      description: "Histórico acumulado",
      href: "/districts",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Dashboard General</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen global de distritos, iglesias, miembros y estadísticas de bautismos.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Link key={kpi.title} href={kpi.href} className="block group">
              <Card className="transition-all hover:border-primary/50 hover:shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-serif text-2xl font-bold">{kpi.value}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Evolución de Bautismos por Año
            </CardTitle>
            <CardDescription>
              Comparativa histórica de baptismos acumulados por año.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BaptismsByYearChart data={data.baptismsByYear} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Waves className="size-4 text-primary" />
              Bautismos Mensuales (Año Actual)
            </CardTitle>
            <CardDescription>
              Progreso mes a mes de los bautismos en el año en curso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BaptismsByMonthChart data={data.baptismsByMonth} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPinned className="size-4 text-primary" />
              Distribución de Miembros por Distrito
            </CardTitle>
            <CardDescription>
              Fotografía de miembros actuales agregados por distrito pastoral.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersByDistrictChart data={data.membersByDistrict} />
          </CardContent>
        </Card>
      </div>

      {/* Rankings Section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Top Distritos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              Top Distritos por Bautismos
            </CardTitle>
            <CardDescription>Mayor cantidad acumulada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topDistricts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin registros.</p>
            ) : (
              data.topDistricts.map((d, index) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {d.baptisms} bautismos
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Iglesias */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Church className="size-4 text-primary" />
              Top Iglesias por Bautismos
            </CardTitle>
            <CardDescription>Iglesias con más conversiones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topChurches.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin registros.</p>
            ) : (
              data.topChurches.map((c, index) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground ml-7">
                      {c.district}
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {c.baptisms} bautismos
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Pastores en sus gestiones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-600" />
              Pastores Destacados
            </CardTitle>
            <CardDescription>Bautismos durante sus gestiones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pastorRanking.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin registros.</p>
            ) : (
              data.pastorRanking.map((p, index) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {p.baptisms} bautismos
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
