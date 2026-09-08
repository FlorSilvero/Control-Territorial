import { config } from "dotenv"
config({ path: ".env.local" })
import { createPrismaClient } from "../lib/prisma"
import bcrypt from "bcryptjs"
import {
  DISTRITOS_2026,
  SNAPSHOT_YEAR,
  SNAPSHOT_MONTH,
  ASSIGNMENT_START,
} from "./data/distritos-2026"

const prisma = createPrismaClient()

async function main() {
  console.log("[seed] starting...")

  // ---- Organization (tenant) ----
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Asociación Central", slug: "default" },
  })

  // ---- Admin user ----
  const hashedPassword = await bcrypt.hash("admin1234", 10)
  await prisma.user.upsert({
    where: { email: "admin@iglesia.app" },
    update: {},
    create: {
      email: "admin@iglesia.app",
      name: "Administrador",
      hashedPassword,
      role: "ADMIN",
      organizationId: org.id,
    },
  })

  // Wipe domain data for a clean reseed (keeps org + user). Children first so
  // no delete trips a foreign key.
  await prisma.auditLog.deleteMany({ where: { organizationId: org.id } })
  await prisma.statisticRecord.deleteMany({ where: { organizationId: org.id } })
  await prisma.pastorAssignment.deleteMany({ where: { organizationId: org.id } })
  await prisma.church.deleteMany({ where: { organizationId: org.id } })
  await prisma.district.deleteMany({ where: { organizationId: org.id } })
  await prisma.pastor.deleteMany({ where: { organizationId: org.id } })

  let churchCount = 0

  for (const entry of DISTRITOS_2026) {
    const district = await prisma.district.create({
      data: { name: entry.name, organizationId: org.id },
    })

    const pastor = await prisma.pastor.create({
      data: {
        firstName: entry.pastor.firstName,
        lastName: entry.pastor.lastName,
        organizationId: org.id,
      },
    })

    await prisma.pastorAssignment.create({
      data: {
        organizationId: org.id,
        pastorId: pastor.id,
        districtId: district.id,
        startDate: ASSIGNMENT_START,
        endDate: null,
      },
    })

    for (const congregation of entry.congregations) {
      const church = await prisma.church.create({
        data: {
          name: congregation.name,
          type: congregation.type,
          organizationId: org.id,
          districtId: district.id,
        },
      })
      churchCount++

      // The source is a single membership snapshot, so it lands as one monthly
      // record. Baptisms aren't in the source and start at zero.
      await prisma.statisticRecord.create({
        data: {
          organizationId: org.id,
          churchId: church.id,
          period: "MONTHLY",
          year: SNAPSHOT_YEAR,
          month: SNAPSHOT_MONTH,
          memberCount: congregation.members,
          baptismCount: 0,
        },
      })
    }
  }

  console.log(
    `[seed] done — ${DISTRITOS_2026.length} distritos, ${DISTRITOS_2026.length} pastores, ${churchCount} congregaciones.`,
  )
  console.log("[seed] login -> admin@iglesia.app / admin1234")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
