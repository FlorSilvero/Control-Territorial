import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BaptismsByYearChart,
  BaptismsByMonthChart,
  MembersByDistrictChart,
} from "@/components/dashboard/dashboard-charts"
import {
  MapPinned,
  Church,
  Users,
  UserCheck,
  Waves,
  Trophy,
  TrendingUp,
  Clock,
  AlertTriangle,
  Hourglass,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatDate, formatBirthDate, RETIREMENT_AGE, RETIREMENT_WARNING_YEARS } from "@/lib/date-utils"
import type { getDashboardData } from "@/lib/queries"

/** Pastores con más de este tiempo en su distrito se resaltan en el dashboard. */
const LONG_TENURE_MONTHS = 36

export function DashboardGlobalView({ data }: { data: Awaited<ReturnType<typeof getDashboardData>> }) {
  const currentYear = new Date().getFullYear()
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
      href: null,
    },
    {
      title: "Bautismos Acumulados",
      value: data.kpis.baptisms.toLocaleString("es-AR"),
      icon: Waves,
      description: `Acumulado ${currentYear}`,
      href: null,
    },
  ]

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          const cardBody = (
            <Card
              className={
                kpi.href ? "transition-all hover:border-primary/50 hover:shadow-sm" : undefined
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div
                  className={
                    kpi.href
                      ? "rounded-md bg-primary/10 p-1.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      : "rounded-md bg-primary/10 p-1.5 text-primary"
                  }
                >
                  <Icon className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-serif text-2xl font-bold">{kpi.value}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.description}</p>
              </CardContent>
            </Card>
          )

          if (!kpi.href) {
            return <div key={kpi.title}>{cardBody}</div>
          }

          return (
            <Link key={kpi.title} href={kpi.href} className="block group">
              {cardBody}
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
              Total de bautismos registrados en cada año.
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

      <PastorTenureCard tenures={data.pastorTenures} vacantDistricts={data.vacantDistricts} />

      <UpcomingRetirementsCard retirements={data.upcomingRetirements} />

      {/* Rankings Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Distritos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              Top Distritos por Bautismos
            </CardTitle>
            <CardDescription>Acumulado {currentYear}</CardDescription>
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

        {/* Top Pastores en sus gestiones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-600" />
              Pastores Destacados
            </CardTitle>
            <CardDescription>Acumulado {currentYear} en sus gestiones</CardDescription>
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

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

function PastorTenureCard({
  tenures,
  vacantDistricts,
}: {
  tenures: DashboardData["pastorTenures"]
  vacantDistricts: DashboardData["vacantDistricts"]
}) {
  const longCount = tenures.filter((t) => t.months > LONG_TENURE_MONTHS).length
  const maxMonths = Math.max(LONG_TENURE_MONTHS, ...tenures.map((t) => t.months))
  const markerPct = (LONG_TENURE_MONTHS / maxMonths) * 100

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Tiempo de cada Pastor en su Distrito
            </CardTitle>
            <CardDescription>
              Ordenado de mayor a menor antigüedad en la asignación actual. La línea marca los 3
              años.
            </CardDescription>
          </div>
          {tenures.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 shrink-0">
              <AlertTriangle className="size-3.5" />
              <span>
                <span className="font-bold">{longCount}</span> de {tenures.length}{" "}
                {tenures.length === 1 ? "pastor lleva" : "pastores llevan"} más de 3 años
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tenures.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay pastores asignados actualmente.</p>
        ) : (
          <ul className="lg:columns-2 lg:gap-x-8">
            {tenures.map((t) => {
              const isLong = t.months > LONG_TENURE_MONTHS
              const widthPct = Math.max(2, (t.months / maxMonths) * 100)
              return (
                <li
                  key={`${t.districtId}-${t.pastorId}`}
                  className={cn(
                    "break-inside-avoid border-l-2 pl-3 py-2 mb-1 rounded-r-md",
                    isLong ? "border-amber-500 bg-amber-500/5" : "border-transparent",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0 truncate">
                      <Link href={`/pastors/${t.pastorId}`} className="font-medium hover:underline">
                        {t.pastorName}
                      </Link>
                      <span className="text-muted-foreground"> · </span>
                      <Link
                        href={`/districts/${t.districtId}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {t.districtName}
                      </Link>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        isLong ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                      )}
                    >
                      {t.duration}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", isLong ? "bg-amber-500" : "bg-primary/70")}
                      style={{ width: `${widthPct}%` }}
                    />
                    <div
                      className="absolute -top-0.5 h-2.5 w-px bg-foreground/40"
                      style={{ left: `${markerPct}%` }}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Desde {formatDate(t.since)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        {vacantDistricts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <span>Distritos sin pastor asignado:</span>
            {vacantDistricts.map((d) => (
              <Link key={d.id} href={`/districts/${d.id}`}>
                <Badge variant="outline" className="hover:bg-muted">
                  {d.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UpcomingRetirementsCard({
  retirements,
}: {
  retirements: DashboardData["upcomingRetirements"]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Hourglass className="size-4 text-destructive" />
          Próximas Jubilaciones
        </CardTitle>
        <CardDescription>
          Pastores a los que les faltan menos de {RETIREMENT_WARNING_YEARS} años para cumplir{" "}
          {RETIREMENT_AGE}, ordenados por fecha de jubilación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {retirements.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ningún pastor está a menos de {RETIREMENT_WARNING_YEARS} años de jubilarse.
          </p>
        ) : (
          <ul className="lg:columns-2 lg:gap-x-8">
            {retirements.map((r) => (
              <li
                key={r.pastorId}
                className="break-inside-avoid border-l-2 border-destructive/60 bg-destructive/5 pl-3 py-2 mb-1 rounded-r-md"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <div className="min-w-0 truncate">
                    <Link href={`/pastors/${r.pastorId}`} className="font-medium hover:underline">
                      {r.pastorName}
                    </Link>
                    <span className="text-muted-foreground"> · </span>
                    {r.districtId ? (
                      <Link
                        href={`/districts/${r.districtId}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {r.districtName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sin distrito</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-destructive">
                    {r.status === "reached" ? `Ya cumplió ${RETIREMENT_AGE}` : `Faltan ${r.timeLeft}`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.age} años · Cumple {RETIREMENT_AGE} el {formatBirthDate(r.retirementDate)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
