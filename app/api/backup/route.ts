import { NextResponse } from "next/server"
import path from "node:path"
import { createBackup } from "@/lib/backup"
import { prisma } from "@/lib/prisma"

// Triggered by the Electron shell (see electron/main.js) on launch and on
// quit — desktop users never run the app from a terminal, so this is the
// only path an automatic backup can take. Guarded by AUTH_SECRET since the
// local server has no other auth on this route.
export async function POST(request: Request) {
  const secret = request.headers.get("x-backup-secret")
  if (!process.env.AUTH_SECRET || secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups")
  const { filePath, counts } = await createBackup(prisma, dir)

  return NextResponse.json({ filePath, counts })
}
