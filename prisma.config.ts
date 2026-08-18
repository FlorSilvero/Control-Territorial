import path from "node:path"
import { config as loadEnv } from "dotenv"
import type { PrismaConfig } from "prisma"
import { env } from "prisma/config"

// Neon connection string is provided by v0 in .env.development.local
loadEnv({ path: ".env.development.local" })
loadEnv({ path: ".env.local" })
loadEnv()

export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
} satisfies PrismaConfig
