const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

// `prisma migrate deploy` no viaja dentro del instalador: es un CLI con motores
// nativos aparte, demasiado para arrastrar. Pero en SQLite las migraciones son
// .sql planos, así que acá se reproducen las pendientes y se registran igual que
// lo haría Prisma —misma tabla, mismo checksum, mismo orden— para que una base
// migrada por la app y una migrada en desarrollo sean indistinguibles.

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`

function readMigrations(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // El nombre arranca con un timestamp, así que alfabético es cronológico.
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"))
      return {
        name,
        sql: sql.toString("utf8"),
        // Prisma hashea los bytes crudos del archivo.
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      }
    })
}

// `node:sqlite` viene compilado dentro de Electron y es el camino preferido: no
// depende de módulos nativos ni del ABI con el que se compilaron. Aun así se
// mantiene el better-sqlite3 que ya viaja en el paquete como respaldo, porque si
// esa API no estuviera disponible la app no abriría y el error sería mudo.
// Ambas librerías comparten la porción de API que se usa acá: exec, prepare,
// all, run y close.
function openDatabase(dbPath, resourcesPath) {
  let db
  try {
    const { DatabaseSync } = require("node:sqlite")
    db = new DatabaseSync(dbPath)
  } catch {
    const bundled = path.join(
      resourcesPath,
      "app/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3",
    )
    const Database = require(bundled)
    db = new Database(dbPath)
  }
  // Las migraciones traen sus propios PRAGMA (el RedefineTables de SQLite
  // necesita las foreign keys apagadas). Se normaliza acá, fuera de toda
  // transacción, porque cada librería arranca con un valor distinto y dentro de
  // una transacción este PRAGMA se ignora en silencio.
  db.exec("PRAGMA foreign_keys = OFF")
  return db
}

// VACUUM INTO produce una copia consistente sin depender del journal_mode ni de
// que existan archivos -wal/-journal al lado.
function snapshot(db, dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const target = `${dbPath}.pre-migracion-${stamp}`
  db.prepare("VACUUM INTO ?").run(target)
  return target
}

/**
 * Lleva la base al esquema que espera esta versión de la app.
 * Devuelve { applied: string[], snapshot: string | null }.
 * Si algo falla, restaura la base al estado previo y agrega `restoredFrom` al error.
 */
function migrate(dbPath, migrationsDir, resourcesPath) {
  const available = readMigrations(migrationsDir)
  const db = openDatabase(dbPath, resourcesPath)
  let snapshotPath = null
  let closed = false

  try {
    db.exec(MIGRATIONS_TABLE)
    const applied = new Set(
      db
        .prepare('SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL')
        .all()
        .map((row) => row.migration_name),
    )

    // Base escrita por una versión más nueva: no se puede migrar hacia atrás, y
    // seguir adelante escribiría sobre un esquema que no conocemos.
    const known = new Set(available.map((migration) => migration.name))
    const ahead = [...applied].filter((name) => !known.has(name))
    if (ahead.length > 0) {
      throw new Error(
        "Los datos fueron creados por una versión más nueva de la aplicación " +
          `(${ahead.join(", ")}). Instalá la última versión para poder abrirlos.`,
      )
    }

    const pending = available.filter((migration) => !applied.has(migration.name))
    if (pending.length === 0) return { applied: [], snapshot: null }

    snapshotPath = snapshot(db, dbPath)

    for (const migration of pending) {
      const startedAt = Date.now()
      // Cada migración va en su propia transacción: en SQLite el DDL es
      // transaccional, así que una que falle no deja la tabla a medio rehacer.
      db.exec("BEGIN")
      try {
        db.exec(migration.sql)
        db.prepare(
          `INSERT INTO "_prisma_migrations"
             ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
           VALUES (?, ?, ?, ?, ?, 1)`,
        ).run(crypto.randomUUID(), migration.checksum, Date.now(), migration.name, startedAt)
        db.exec("COMMIT")
      } catch (cause) {
        db.exec("ROLLBACK")
        throw new Error(`Falló la migración ${migration.name}: ${cause.message}`, { cause })
      }
    }

    return { applied: pending.map((migration) => migration.name), snapshot: snapshotPath }
  } catch (err) {
    // Las migraciones anteriores de esta misma tanda ya commitearon; volver al
    // snapshot deja la base como estaba, utilizable con la versión anterior.
    if (snapshotPath) {
      db.close()
      closed = true
      fs.copyFileSync(snapshotPath, dbPath)
      err.restoredFrom = snapshotPath
    }
    throw err
  } finally {
    if (!closed) db.close()
  }
}

module.exports = { migrate, readMigrations, openDatabase }
