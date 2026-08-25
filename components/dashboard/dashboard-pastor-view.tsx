import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatDuration } from "@/lib/date-utils"
import { MapPinned, Waves, UserCheck, History, ArrowRight } from "lucide-react"
import type { getPastorDetail } from "@/lib/queries"

type PastorDetail = NonNullable<Awaited<ReturnType<typeof getPastorDetail>>>

export function DashboardPastorView({ data }: { data: PastorDetail }) {
  const careerBaptisms = data.assignments.reduce((acc, a) => acc + a.baptisms, 0)

  const kpis = [
    {
      title: "Distrito actual",
      value: data.currentDistrict ? data.currentDistrict.name : "Sin gestión activa",
      icon: MapPinned,
    },
    {
      title: "Antigüedad en gestión actual",
      value: data.currentDistrict ? formatDuration(data.currentDistrict.since, null) : "—",
      icon: History,
    },
    { title: "Bautismos en su carrera", value: careerBaptisms, icon: Waves },
    { title: "Gestiones registradas", value: data.assignments.length, icon: UserCheck },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">
            {data.firstName} {data.lastName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data.email || "Sin correo registrado"}
          </p>
        </div>
        <Link
          href={`/pastors/${data.id}`}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <History className="size-4 text-primary" />
            Historial de gestiones
          </CardTitle>
          <CardDescription>Distritos pastoreados y bautismos durante cada tenencia.</CardDescription>
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
                  <span className="font-medium">{a.district.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(a.startDate)} — {a.endDate ? formatDate(a.endDate) : "Actualidad"}
                    {" · "}
                    {formatDuration(a.startDate, a.endDate)}
                  </span>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {a.baptisms} bautismos
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
