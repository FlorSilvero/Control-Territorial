"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { restoreDistrict } from "@/lib/actions/districts"
import { restoreChurch } from "@/lib/actions/churches"
import { restorePastor } from "@/lib/actions/pastors"
import { formatDate } from "@/lib/date-utils"
import { MapPinned, Church, Users, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import type { listDistricts, listChurches, listPastors } from "@/lib/queries"

// Derived from the queries that feed this view, so a change to any of them
// surfaces here at compile time instead of as a runtime undefined.
// `import type` is erased, so pulling from a "server-only" module is safe.
type ArchivedData = {
  districts: Awaited<ReturnType<typeof listDistricts>>
  churches: Awaited<ReturnType<typeof listChurches>>
  pastors: Awaited<ReturnType<typeof listPastors>>
}

export function ArchivedClient({
  data,
  canEdit,
}: {
  data: ArchivedData
  /** VIEWER users get a read-only page: the server refuses these actions anyway. */
  canEdit: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleRestoreDistrict = (id: string, name: string) => {
    if (!confirm(`¿Restaurar el distrito ${name}?`)) return
    startTransition(async () => {
      const res = await restoreDistrict(id)
      if (res.ok) {
        toast.success("Distrito restaurado con éxito")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleRestoreChurch = (id: string, name: string) => {
    if (!confirm(`¿Restaurar la iglesia ${name}?`)) return
    startTransition(async () => {
      const res = await restoreChurch(id)
      if (res.ok) {
        toast.success("Iglesia restaurada con éxito")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const handleRestorePastor = (id: string, name: string) => {
    if (!confirm(`¿Restaurar el pastor ${name}?`)) return
    startTransition(async () => {
      const res = await restorePastor(id)
      if (res.ok) {
        toast.success("Pastor restaurado con éxito")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Elementos Archivados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de distritos, iglesias y pastores archivados. Su información histórica se conserva intacta.
        </p>
      </div>

      <Tabs defaultValue="districts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="districts" className="gap-2">
            <MapPinned className="size-4" />
            Distritos ({data.districts.length})
          </TabsTrigger>
          <TabsTrigger value="churches" className="gap-2">
            <Church className="size-4" />
            Iglesias ({data.churches.length})
          </TabsTrigger>
          <TabsTrigger value="pastors" className="gap-2">
            <Users className="size-4" />
            Pastores ({data.pastors.length})
          </TabsTrigger>
        </TabsList>

        {/* ARCHIVED DISTRICTS */}
        <TabsContent value="districts">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">Distritos Archivados</CardTitle>
              <CardDescription>
                Distritos fuera de operaciones actuales. Podés restaurarlos en cualquier momento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.districts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No hay distritos archivados.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Fecha de archivado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.districts.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold">{d.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(d.archivedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreDistrict(d.id, d.name)}
                              disabled={isPending}
                              className="gap-1.5"
                            >
                              <RotateCcw className="size-3.5" />
                              Restaurar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ARCHIVED CHURCHES */}
        <TabsContent value="churches">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">Iglesias Archivadas</CardTitle>
              <CardDescription>
                Iglesias inactivas. Mantienen todo su historial estadístico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.churches.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No hay iglesias archivadas.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de Iglesia</TableHead>
                      <TableHead>Distrito</TableHead>
                      <TableHead>Fecha de archivado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.churches.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">{c.name}</TableCell>
                        <TableCell>{c.district?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(c.archivedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreChurch(c.id, c.name)}
                              disabled={isPending}
                              className="gap-1.5"
                            >
                              <RotateCcw className="size-3.5" />
                              Restaurar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ARCHIVED PASTORS */}
        <TabsContent value="pastors">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg font-bold">Pastores Archivados</CardTitle>
              <CardDescription>
                Pastores inactivos o retirados. Sus gestiones previas continúan intactas en la historia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.pastors.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No hay pastores archivados.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre y Apellido</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Fecha de archivado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pastors.map((p) => {
                      const name = `${p.firstName} ${p.lastName}`
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold">{name}</TableCell>
                          <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(p.archivedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestorePastor(p.id, name)}
                                disabled={isPending}
                                className="gap-1.5"
                              >
                                <RotateCcw className="size-3.5" />
                                Restaurar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
