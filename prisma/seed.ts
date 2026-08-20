import { config } from "dotenv"
config({ path: ".env.local" })
import { createPrismaClient } from "../lib/prisma"
import bcrypt from "bcryptjs"

const prisma = createPrismaClient()

const CURRENT_YEAR = new Date().getFullYear()

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

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

  // Wipe domain data for a clean reseed (keeps org + user)
  await prisma.statisticRecord.deleteMany({ where: { organizationId: org.id } })
  await prisma.pastorAssignment.deleteMany({ where: { organizationId: org.id } })
  await prisma.church.deleteMany({ where: { organizationId: org.id } })
  await prisma.district.deleteMany({ where: { organizationId: org.id } })
  await prisma.pastor.deleteMany({ where: { organizationId: org.id } })

  // ---- Districts ----
  const districtNames = ["Distrito Centro", "Distrito Norte", "Distrito Sur"]
  const districts = []
  for (const name of districtNames) {
    districts.push(
      await prisma.district.create({
        data: { name, organizationId: org.id },
      }),
    )
  }

  // ---- Pastors ----
  const pastorData = [
    ["Juan", "Pérez"],
    ["Carlos", "Gómez"],
    ["Marta", "Sosa"],
  ]
  const pastors = []
  for (const [firstName, lastName] of pastorData) {
    pastors.push(
      await prisma.pastor.create({
        data: {
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}@iglesia.app`,
          organizationId: org.id,
        },
      }),
    )
  }

  // ---- Pastor assignments ----
  // Pastor Juan: Centro
  await prisma.pastorAssignment.create({
    data: {
      organizationId: org.id,
      pastorId: pastors[0].id,
      districtId: districts[0].id,
      startDate: new Date("2023-07-01"),
      endDate: null,
    },
  })
  // Pastor Carlos: Norte
  await prisma.pastorAssignment.create({
    data: {
      organizationId: org.id,
      pastorId: pastors[1].id,
      districtId: districts[1].id,
      startDate: new Date("2023-07-01"),
      endDate: null,
    },
  })
  // Pastor Marta: Sur
  await prisma.pastorAssignment.create({
    data: {
      organizationId: org.id,
      pastorId: pastors[2].id,
      districtId: districts[2].id,
      startDate: new Date("2023-07-01"),
      endDate: null,
    },
  })

  // ---- Churches ----
  const churchesByDistrict: Record<string, string[]> = {
    [districts[0].id]: ["Iglesia Central", "Iglesia Emmanuel", "Iglesia Betel"],
    [districts[1].id]: ["Iglesia Norte", "Iglesia Esperanza", "Iglesia Nueva Vida"],
    [districts[2].id]: ["Iglesia Sur", "Iglesia Getsemaní", "Iglesia Filadelfia"],
  }

  const churches = []
  for (const [districtId, names] of Object.entries(churchesByDistrict)) {
    for (const name of names) {
      churches.push(
        await prisma.church.create({
          data: { name, organizationId: org.id, districtId },
        }),
      )
    }
  }

  // ---- Statistics ----
  // Annual records for past years + monthly records for the current year.
  for (const church of churches) {
    let members = rand(60, 180)

    // Past annual records
    for (let year = CURRENT_YEAR - 4; year < CURRENT_YEAR; year++) {
      const baptisms = rand(5, 40)
      members += rand(-5, baptisms)
      await prisma.statisticRecord.create({
        data: {
          organizationId: org.id,
          churchId: church.id,
          period: "ANNUAL",
          year,
          month: null,
          memberCount: members,
          baptismCount: baptisms,
        },
      })
    }

    // Current year monthly records (up to current month)
    const currentMonth = new Date().getMonth() + 1
    for (let month = 1; month <= currentMonth; month++) {
      const baptisms = rand(0, 6)
      members += rand(0, baptisms)
      await prisma.statisticRecord.create({
        data: {
          organizationId: org.id,
          churchId: church.id,
          period: "MONTHLY",
          year: CURRENT_YEAR,
          month,
          memberCount: members,
          baptismCount: baptisms,
        },
      })
    }
  }

  console.log("[seed] done.")
  console.log("[seed] login -> admin@iglesia.app / admin1234")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
