import { z } from "zod"

/** Prisma model ids are cuids — reject anything else before it reaches a query. */
export const idSchema = z.cuid("ID inválido")

/** Free-text search query used by the global search box. */
export const searchQuerySchema = z.string().trim().max(100, "Búsqueda demasiado larga")

export const districtSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type DistrictInput = z.infer<typeof districtSchema>

export const churchSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  districtId: idSchema,
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type ChurchInput = z.infer<typeof churchSchema>

export const pastorSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
  lastName: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres").max(80),
  email: z.string().trim().max(254).email("Email inválido").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type PastorInput = z.infer<typeof pastorSchema>

export const assignmentSchema = z.object({
  pastorId: idSchema,
  districtId: idSchema,
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio es obligatoria"),
})
export type AssignmentInput = z.infer<typeof assignmentSchema>

const currentYear = new Date().getFullYear()

export const statisticSchema = z
  .object({
    churchId: idSchema,
    period: z.enum(["ANNUAL", "MONTHLY"]),
    year: z.coerce.number().int().min(1900).max(currentYear + 1),
    month: z.coerce.number().int().min(1).max(12).optional().nullable(),
    memberCount: z.coerce.number().int().min(0, "No puede ser negativo").max(10_000_000),
    baptismCount: z.coerce.number().int().min(0, "No puede ser negativo").max(10_000_000),
  })
  .refine((v) => (v.period === "MONTHLY" ? v.month != null : true), {
    message: "El mes es obligatorio para registros mensuales",
    path: ["month"],
  })
export type StatisticInput = z.infer<typeof statisticSchema>
