import { config } from "dotenv"
config({ path: ".env.local" })

import path from "node:path"
import { createBackup } from "../lib/backup"
import { createPrismaClient } from "../lib/prisma"

const prisma = createPrismaClient()

async function main() {
  console.log("[backup] reading database...")
  const { filePath, counts } = await createBackup(prisma, path.join(process.cwd(), "backups"))
  console.log(`[backup] saved -> ${filePath}`)
  console.table(counts)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
