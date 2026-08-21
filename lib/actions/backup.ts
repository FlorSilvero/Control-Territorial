"use server"

import fs from "node:fs"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { requireSession, isAdmin } from "@/lib/session"
import {
  createBackup,
  listBackups,
  parseBackupFile,
  restoreBackup,
  type BackupListEntry,
} from "@/lib/backup"
import { audit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Where the Electron shell writes its automatic backups (see electron/main.js);
 * falls back to ./backups when the app runs from a terminal in development.
 */
function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "backups")
}

/** A restore point is only offered if the file parses as one of our backups. */
export async function getBackups(): Promise<BackupListEntry[]> {
  await requireSession()
  return listBackups(backupDir())
}

export async function createBackupAction(): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!isAdmin(ctx.role)) return { ok: false, error: "Solo un administrador puede crear backups" }

  try {
    const { filePath, counts } = await createBackup(prisma, backupDir())
    await audit(ctx.organizationId, ctx.userId, "backup.create", "backup", path.basename(filePath), {
      counts,
    })
    revalidatePath("/settings/backups")
    return { ok: true, message: `Backup creado: ${path.basename(filePath)}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear el backup" }
  }
}

/**
 * Point-in-time restore: the ENTIRE database is replaced by the contents of
 * the chosen file. Anything recorded after that backup was taken is lost, so
 * the current state is snapshotted first — that safety copy is the only way
 * back if the wrong file gets picked.
 *
 * The caller must sign out afterwards: the restored organization and user ids
 * are not necessarily the ones baked into the current JWT, and a session
 * pointing at an organization that no longer exists sees an empty app.
 */
export async function restoreBackupAction(name: string): Promise<ActionResult> {
  const ctx = await requireSession()
  if (!isAdmin(ctx.role)) return { ok: false, error: "Solo un administrador puede restaurar un backup" }

  // Reject anything that isn't a plain file name: this value indexes into a
  // directory, so "../../etc/passwd" must never resolve.
  if (!/^backup-[\w.-]+\.json$/.test(name) || name.includes("..")) {
    return { ok: false, error: "Nombre de backup inválido" }
  }

  const dir = backupDir()
  const filePath = path.join(/*turbopackIgnore: true*/ dir, name)
  if (path.dirname(path.resolve(/*turbopackIgnore: true*/ filePath)) !== path.resolve(/*turbopackIgnore: true*/ dir)) {
    return { ok: false, error: "Nombre de backup inválido" }
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return { ok: false, error: "El backup ya no existe" }

  let backup
  try {
    backup = parseBackupFile(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8"))
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Backup ilegible" }
  }

  // Snapshot the current state before destroying it.
  let safetyCopy: string
  try {
    const { filePath: created } = await createBackup(prisma, dir)
    safetyCopy = path.basename(created)
  } catch {
    return {
      ok: false,
      error: "No se pudo crear la copia de seguridad previa. Se canceló la restauración.",
    }
  }

  try {
    const restored = await restoreBackup(prisma, backup)
    // Written after the restore, so it lands in the restored database rather
    // than being wiped along with everything else.
    await audit(ctx.organizationId, ctx.userId, "backup.restore", "backup", name, {
      restored,
      safetyCopy,
    })
    revalidatePath("/", "layout")
    return {
      ok: true,
      message: `Base restaurada desde ${name}. Copia previa guardada como ${safetyCopy}.`,
    }
  } catch (error) {
    return {
      ok: false,
      error: `Falló la restauración (no se modificó nada): ${
        error instanceof Error ? error.message : "error desconocido"
      }. Copia previa: ${safetyCopy}`,
    }
  }
}
