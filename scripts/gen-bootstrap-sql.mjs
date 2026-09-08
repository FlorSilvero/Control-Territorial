/**
 * Builds a single SQL file that brings an empty Supabase database to the exact
 * state of the old desktop database: schema, Prisma's own migration bookkeeping
 * (so `prisma migrate deploy` later sees the baseline as applied), and every row
 * from the SQLite dump.
 *
 * Meant for the Supabase SQL editor, which is reachable over HTTPS when the
 * Postgres ports are not.
 */
import fs from "node:fs"
import crypto from "node:crypto"

const MIGRATION = "20260907000000_init"
const migrationPath = `prisma/migrations/${MIGRATION}/migration.sql`
const migrationSql = fs.readFileSync(migrationPath, "utf-8")
const checksum = crypto.createHash("sha256").update(fs.readFileSync(migrationPath)).digest("hex")

const dump = JSON.parse(fs.readFileSync("prisma/data/dump-sqlite.json", "utf-8")).data

// Parent -> child, so no insert references a row that isn't there yet.
const TABLES = [
  ["organizations", "Organization"],
  ["users", "User"],
  ["accounts", "Account"],
  ["sessions", "Session"],
  ["verificationTokens", "VerificationToken"],
  ["districts", "District"],
  ["pastors", "Pastor"],
  ["churches", "Church"],
  ["pastorAssignments", "PastorAssignment"],
  ["statisticRecords", "StatisticRecord"],
  ["auditLogs", "AuditLog"],
]

const JSON_COLUMNS = new Set(["metadata"])

function literal(column, value) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (JSON_COLUMNS.has(column) && typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

const out = []
out.push("-- Control Territorial — carga inicial en Supabase")
out.push("-- Generado desde prisma/data/dump-sqlite.json")
out.push(`-- Migración: ${MIGRATION}`)
out.push("")
out.push("BEGIN;")
out.push("")
out.push("-- ============ 1. Esquema ============")
out.push(migrationSql.trim())
out.push("")
out.push("-- ============ 2. Registro de migración de Prisma ============")
out.push(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id                      VARCHAR(36) PRIMARY KEY NOT NULL,
    checksum                VARCHAR(64) NOT NULL,
    finished_at             TIMESTAMPTZ,
    migration_name          VARCHAR(255) NOT NULL,
    logs                    TEXT,
    rolled_back_at          TIMESTAMPTZ,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count     INTEGER NOT NULL DEFAULT 0
);`)
out.push(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES ('${crypto.randomUUID()}', '${checksum}', now(), '${MIGRATION}', now(), 1);`)
out.push("")
out.push("-- ============ 3. Datos ============")

const counts = {}
for (const [collection, table] of TABLES) {
  const rows = dump[collection] ?? []
  counts[table] = rows.length
  if (rows.length === 0) {
    out.push(`-- ${table}: sin filas`)
    continue
  }
  // Every row of a collection carries the same keys — Prisma's findMany returns
  // full records, nulls included.
  const columns = Object.keys(rows[0])
  out.push(`-- ${table}: ${rows.length} filas`)
  out.push(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES`)
  const values = rows.map((row) => `  (${columns.map((c) => literal(c, row[c])).join(", ")})`)
  out.push(values.join(",\n") + ";")
  out.push("")
}

out.push("COMMIT;")
out.push("")

const target = "prisma/data/supabase-bootstrap.sql"
fs.writeFileSync(target, out.join("\n"))
console.log(`escrito ${target}`)
console.table(counts)
