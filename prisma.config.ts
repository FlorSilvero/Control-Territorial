import path from "node:path"
import { config as loadEnv } from "dotenv"
import type { PrismaConfig } from "prisma"
import { env } from "prisma/config"

loadEnv({ path: ".env.local" })
loadEnv()

export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection: Supabase's transaction pooler does
    // not support the prepared statements and advisory locks the migrate
    // engine relies on. DIRECT_URL is the port-5432 connection string.
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
} satisfies PrismaConfig
