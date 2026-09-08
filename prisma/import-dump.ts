/**
 * One-shot data migration: loads a JSON dump exported from the old local
 * SQLite database into the Postgres database that DATABASE_URL points at.
 *
 * Usage: npm run import:dump -- prisma/data/dump-sqlite.json
 *
 * The dump is the format the desktop app's backup feature produced:
 * { meta: { createdAt, counts }, data: { organizations: [...], ... } }.
 *
 * Refuses to run against a database that already holds an organization, so a
 * second accidental run cannot duplicate or clobber live data.
 */
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import fs from "node:fs"
import path from "node:path"
import { Prisma } from "../lib/generated/prisma/client"
import { createPrismaClient } from "../lib/prisma"

/** Parent -> child order, so every foreign key already has its target. */
const COLLECTIONS = [
  "organizations",
  "users",
  "accounts",
  "sessions",
  "verificationTokens",
  "districts",
  "pastors",
  "churches",
  "pastorAssignments",
  "statisticRecords",
  "auditLogs",
] as const

type Collection = (typeof COLLECTIONS)[number]

/** JSON has no date type: every Date left SQLite as an ISO string. */
const DATE_FIELDS: Record<Collection, string[]> = {
  organizations: ["createdAt", "updatedAt"],
  users: ["emailVerified", "createdAt", "updatedAt"],
  accounts: [],
  sessions: ["expires"],
  verificationTokens: ["expires"],
  districts: ["createdAt", "updatedAt", "archivedAt"],
  pastors: ["createdAt", "updatedAt", "archivedAt"],
  churches: ["createdAt", "updatedAt", "archivedAt"],
  pastorAssignments: ["startDate", "endDate", "createdAt", "updatedAt"],
  statisticRecords: ["createdAt", "updatedAt"],
  auditLogs: ["createdAt"],
}

const prisma = createPrismaClient()

/* eslint-disable @typescript-eslint/no-explicit-any -- the delegate is picked
   by a runtime collection name, which no static union can narrow for Prisma. */
function delegateFor(tx: Prisma.TransactionClient, collection: Collection): any {
  const map: Record<Collection, unknown> = {
    organizations: tx.organization,
    users: tx.user,
    accounts: tx.account,
    sessions: tx.session,
    verificationTokens: tx.verificationToken,
    districts: tx.district,
    pastors: tx.pastor,
    churches: tx.church,
    pastorAssignments: tx.pastorAssignment,
    statisticRecords: tx.statisticRecord,
    auditLogs: tx.auditLog,
  }
  return map[collection]
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function revive(collection: Collection, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row }
  for (const field of DATE_FIELDS[collection]) {
    const value = out[field]
    if (typeof value === "string") {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Fecha inválida en ${collection}.${field}: "${value}"`)
      }
      out[field] = date
    }
  }
  // A Json column can't take a bare null through createMany — Prisma needs the
  // explicit JsonNull sentinel to tell "SQL NULL" from "the JSON value null".
  if (collection === "auditLogs" && out.metadata === null) {
    out.metadata = Prisma.JsonNull
  }
  return out
}

async function main() {
  const file = process.argv[2] ?? path.join("prisma", "data", "dump-sqlite.json")
  const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as {
    meta?: { createdAt?: string }
    data?: Record<string, Record<string, unknown>[]>
  }
  const data = parsed.data
  if (!data) throw new Error(`${file} no tiene el formato de un backup (falta "data")`)

  for (const collection of COLLECTIONS) {
    if (!Array.isArray(data[collection])) {
      throw new Error(`El dump no incluye la colección "${collection}"`)
    }
  }

  const existing = await prisma.organization.count()
  if (existing > 0) {
    throw new Error(
      `La base de destino ya tiene ${existing} organización(es). ` +
        "Borrala antes de importar o el import duplicaría los datos.",
    )
  }

  console.log(`[import] dump: ${file} (${parsed.meta?.createdAt ?? "sin fecha"})`)

  const counts: Record<string, number> = {}
  // One transaction: a failure halfway leaves the target database empty
  // instead of half-populated.
  await prisma.$transaction(
    async (tx) => {
      for (const collection of COLLECTIONS) {
        const rows = data[collection].map((row) => revive(collection, row))
        if (rows.length > 0) {
          await delegateFor(tx, collection).createMany({ data: rows })
        }
        counts[collection] = rows.length
      }
    },
    { timeout: 120_000 },
  )

  console.log("[import] listo")
  console.table(counts)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
