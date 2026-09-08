import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function createPrismaClient() {
  // DATABASE_URL points at Supabase's transaction pooler (port 6543): every
  // serverless invocation gets its own short-lived process, so a per-instance
  // pool of one connection is what keeps Postgres from running out of slots.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 1,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
