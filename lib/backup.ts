import fs from "node:fs"
import path from "node:path"
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

  fs.mkdirSync(dir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filePath = path.join(dir, `backup-${timestamp}.json`)
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf-8")

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
    fs.rmSync(path.join(dir, file))
  }
}
