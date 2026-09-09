/**
 * Carga los bautismos históricos 2021-2026 (prisma/data/bautismos-historicos.json)
 * en la base a la que apunta DATABASE_URL.
 *
 * Uso:
 *   npm run import:bautismos              # simulacro: valida e informa, no escribe
 *   npm run import:bautismos -- --apply   # escribe
 *   npm run import:bautismos -- --org=slug # sólo si hay más de una organización
 *
 * El mapeo distrito -> congregación cabecera está en data/bautismos-mapeo.ts,
 * con el porqué de cada caso especial.
 *
 * memberCount va en 0: la planilla no informa membresía mensual (su columna
 * "Blanco" es la meta de bautismos del año, no miembros). Si el período ya
 * tiene un registro se respeta el memberCount guardado y sólo se pisa
 * baptismCount, así que correr el script dos veces deja la base igual.
 */
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import fs from "node:fs"
import path from "node:path"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"
import { resolveBautismos, type BautismosPayload } from "./data/bautismos-mapeo"

/** Filas por transacción: acota el tiempo de lock y el timeout. */
const CHUNK_SIZE = 200

// DIRECT_URL (session pooler, 5432) y no DATABASE_URL: el pooler de
// transacciones está pensado para las invocaciones cortas de Vercel, no para un
// script que mantiene abiertas transacciones de cientos de upserts.
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("Falta DIRECT_URL (o DATABASE_URL) en el entorno")
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) })

async function main() {
  const apply = process.argv.includes("--apply")
  const payload = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "data", "bautismos-historicos.json"), "utf8"),
  ) as BautismosPayload

  const orgs = await prisma.organization.findMany({ select: { id: true, slug: true, name: true } })
  if (orgs.length === 0) throw new Error("La base no tiene ninguna organización")
  const slug = process.argv.find((a) => a.startsWith("--org="))?.slice("--org=".length)
  const org = slug ? orgs.find((o) => o.slug === slug) : orgs.length === 1 ? orgs[0] : null
  if (!org) {
    throw new Error(
      `Hay ${orgs.length} organizaciones; elegí una con --org=<slug>: ${orgs.map((o) => o.slug).join(", ")}`,
    )
  }
  console.log(`[import] organización: ${org.name} (${org.slug})`)

  const [districts, churches] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: org.id, archivedAt: null },
      select: { id: true, name: true },
    }),
    prisma.church.findMany({
      where: { organizationId: org.id, archivedAt: null },
      select: { id: true, name: true, districtId: true },
    }),
  ])

  const { periods, problems } = resolveBautismos(payload.rows, districts, churches)

  // Reconciliación contra los totales de la planilla, ya verificados al extraer.
  const byYear = new Map<number, number>()
  for (const p of periods) byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.baptisms)
  console.log(`[import] ${periods.length} períodos (iglesia/año/mes)`)
  for (const year of payload.meta.years) {
    const got = byYear.get(year) ?? 0
    const expected = payload.meta.totals[String(year)]
    const ok = got === expected
    console.log(`[import]   ${year}: ${got} bautismos (planilla: ${expected}) ${ok ? "OK" : "<<< NO COINCIDE"}`)
    if (!ok) problems.push(`${year}: se mapearon ${got} bautismos de ${expected}`)
  }

  if (problems.length > 0) {
    console.error(`\n[import] ${problems.length} problema(s) — no se escribe nada:`)
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }

  if (!apply) {
    console.log("\n[import] SIMULACRO: todo válido. Corré con --apply para escribir.")
    for (const p of periods.slice(0, 5)) {
      console.log(
        `  ejemplo: ${p.year}/${p.month} "${p.sourceDistrict}" -> ${p.districtName} / ${p.churchName} = ${p.baptisms}`,
      )
    }
    return
  }

  let written = 0
  for (let offset = 0; offset < periods.length; offset += CHUNK_SIZE) {
    const chunk = periods.slice(offset, offset + CHUNK_SIZE)
    await prisma.$transaction(
      async (tx) => {
        const entries = []
        for (const p of chunk) {
          const record = await tx.statisticRecord.upsert({
            where: { churchId_year_month: { churchId: p.churchId, year: p.year, month: p.month } },
            create: {
              organizationId: org.id,
              churchId: p.churchId,
              period: "MONTHLY",
              year: p.year,
              month: p.month,
              memberCount: 0, // la planilla no informa membresía mensual
              baptismCount: p.baptisms,
            },
            // memberCount no se toca: un registro que ya existe (por ejemplo el
            // snapshot de membresía) conserva su valor.
            update: { baptismCount: p.baptisms },
            select: { id: true },
          })
          entries.push({
            organizationId: org.id,
            action: "statistic.import",
            entityType: "statisticRecord",
            entityId: record.id,
            metadata: {
              origen: payload.meta.source,
              distritoPlanilla: p.sourceDistrict,
              responsable: p.responsable,
              year: p.year,
              month: p.month,
              baptismCount: p.baptisms,
            },
          })
        }
        await tx.auditLog.createMany({ data: entries })
      },
      { timeout: 60_000, maxWait: 15_000 },
    )
    written += chunk.length
    console.log(`[import] ${written}/${periods.length}`)
  }
  console.log(`[import] listo: ${written} registros escritos.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
