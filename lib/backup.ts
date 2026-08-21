import fs from "node:fs"
import path from "node:path"
import { Prisma } from "./generated/prisma/client"
import type { PrismaClient } from "./generated/prisma/client"

const MAX_BACKUPS = 20

export async function createBackup(prisma: PrismaClient, dir: string) {
  const [
    organizations,
    users,
    accounts,
    sessions,
    verificationTokens,
    districts,
    churches,
    pastors,
    pastorAssignments,
    statisticRecords,
    auditLogs,
  ] = await Promise.all([
    prisma.organization.findMany(),
    prisma.user.findMany(),
    prisma.account.findMany(),
    prisma.session.findMany(),
    prisma.verificationToken.findMany(),
    prisma.district.findMany(),
    prisma.church.findMany(),
    prisma.pastor.findMany(),
    prisma.pastorAssignment.findMany(),
    prisma.statisticRecord.findMany(),
    prisma.auditLog.findMany(),
  ])

  const backup = {
    meta: {
      createdAt: new Date().toISOString(),
      counts: {
        organizations: organizations.length,
        users: users.length,
        accounts: accounts.length,
        sessions: sessions.length,
        verificationTokens: verificationTokens.length,
        districts: districts.length,
        churches: churches.length,
        pastors: pastors.length,
        pastorAssignments: pastorAssignments.length,
        statisticRecords: statisticRecords.length,
        auditLogs: auditLogs.length,
      },
    },
    data: {
      organizations,
      users,
      accounts,
      sessions,
      verificationTokens,
      districts,
      churches,
      pastors,
      pastorAssignments,
      statisticRecords,
      auditLogs,
    },
  }

  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filePath = path.join(/*turbopackIgnore: true*/ dir, `backup-${timestamp}.json`)
  fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(backup, null, 2), "utf-8")

  pruneOldBackups(dir)

  return { filePath, counts: backup.meta.counts }
}

// Keeps disk usage bounded — automatic backups accumulate over many app launches.
function pruneOldBackups(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
    .sort()

  const excess = files.length - MAX_BACKUPS
  for (const file of files.slice(0, Math.max(excess, 0))) {
    fs.rmSync(/*turbopackIgnore: true*/ path.join(dir, file))
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Collections in PARENT -> CHILD order. Inserting follows this order so every
 * foreign key already has its target; deleting walks it backwards.
 */
const BACKUP_COLLECTIONS = [
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

type BackupCollection = (typeof BACKUP_COLLECTIONS)[number]

/**
 * JSON has no date type, so every Date came out of createBackup as an ISO
 * string and has to be revived before Prisma will accept it back.
 */
const DATE_FIELDS: Record<BackupCollection, string[]> = {
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

export type BackupFile = {
  meta: { createdAt: string; counts: Record<string, number> }
  data: Record<BackupCollection, Record<string, unknown>[]>
}

export type BackupListEntry = {
  name: string
  createdAt: string
  sizeBytes: number
  counts: Record<string, number>
}

/**
 * Structural check before anything destructive runs. A file that isn't one of
 * ours must be rejected up front — discovering it halfway through would leave
 * the database wiped and only partly repopulated.
 */
export function parseBackupFile(raw: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("El archivo no es JSON válido")
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("El archivo no tiene el formato de un backup")
  }
  const obj = parsed as Record<string, unknown>
  const meta = obj.meta as BackupFile["meta"] | undefined
  const data = obj.data as Record<string, unknown> | undefined

  if (!meta || typeof meta.createdAt !== "string" || !data || typeof data !== "object") {
    throw new Error("El archivo no tiene el formato de un backup")
  }

  for (const collection of BACKUP_COLLECTIONS) {
    if (!Array.isArray(data[collection])) {
      throw new Error(`El backup no incluye la colección "${collection}"`)
    }
  }

  return { meta, data: data as BackupFile["data"] }
}

/** Lists the backups on disk, newest first, skipping unreadable files. */
export function listBackups(dir: string): BackupListEntry[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return []

  const entries: BackupListEntry[] = []
  for (const name of fs.readdirSync(/*turbopackIgnore: true*/ dir)) {
    if (!name.startsWith("backup-") || !name.endsWith(".json")) continue
    const full = path.join(/*turbopackIgnore: true*/ dir, name)
    try {
      const stat = fs.statSync(/*turbopackIgnore: true*/ full)
      const { meta } = parseBackupFile(fs.readFileSync(/*turbopackIgnore: true*/ full, "utf-8"))
      entries.push({
        name,
        createdAt: meta.createdAt,
        sizeBytes: stat.size,
        counts: meta.counts ?? {},
      })
    } catch {
      // A corrupt or foreign file simply isn't offered as a restore point.
      continue
    }
  }

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function reviveDates(
  collection: BackupCollection,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const revived: Record<string, unknown> = { ...row }
  for (const field of DATE_FIELDS[collection]) {
    const value = revived[field]
    if (typeof value === "string") {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Fecha inválida en ${collection}.${field}: "${value}"`)
      }
      revived[field] = date
    }
  }
  // A Json column can't take a bare null through createMany — Prisma needs the
  // explicit JsonNull sentinel to tell "SQL NULL" from "the JSON value null".
  if (collection === "auditLogs" && revived.metadata === null) {
    revived.metadata = Prisma.JsonNull
  }
  return revived
}

/**
 * Replaces the ENTIRE database with the contents of a backup.
 *
 * Destructive by design: this is a point-in-time restore, not a merge, so a
 * row created after the backup was taken is gone afterwards. Callers are
 * expected to snapshot the current state first (see restoreBackupAction) and
 * to force a re-login, since the restored user and organization ids may not
 * be the ones in the caller's session token.
 *
 * The whole thing runs in one transaction: a failure mid-way rolls back to
 * the pre-restore state rather than leaving a half-populated database.
 */
export async function restoreBackup(
  prisma: PrismaClient,
  backup: BackupFile,
): Promise<Record<string, number>> {
  const rows = BACKUP_COLLECTIONS.map((collection) => ({
    collection,
    values: backup.data[collection].map((row) => reviveDates(collection, row)),
  }))

  const restored: Record<string, number> = {}

  await prisma.$transaction(
    async (tx) => {
      // Children first, so no delete trips a foreign key.
      for (const { collection } of [...rows].reverse()) {
        await deleteAll(tx, collection)
      }
      // Then parents first, so no insert references a missing row.
      for (const { collection, values } of rows) {
        if (values.length > 0) await createAll(tx, collection, values)
        restored[collection] = values.length
      }
    },
    { timeout: 60_000 },
  )

  return restored
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the delegate is picked
   by a runtime collection name, which no static union can narrow for Prisma. */
function delegateFor(tx: Prisma.TransactionClient, collection: BackupCollection): any {
  const map: Record<BackupCollection, unknown> = {
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

async function deleteAll(tx: Prisma.TransactionClient, collection: BackupCollection) {
  await delegateFor(tx, collection).deleteMany({})
}

async function createAll(
  tx: Prisma.TransactionClient,
  collection: BackupCollection,
  values: Record<string, unknown>[],
) {
  await delegateFor(tx, collection).createMany({ data: values })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
