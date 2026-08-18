import { z } from "zod"

export const districtSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  notes: z.string().max(1000).optional().or(z.literal("")),
})
export type DistrictInput = z.infer<typeof districtSchema>

export const churchSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  districtId: z.string().min(1, "Seleccioná un distrito"),
  address: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})
export type ChurchInput = z.infer<typeof churchSchema>

export const pastorSchema = z.object({
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres").max(80),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
})
export type PastorInput = z.infer<typeof pastorSchema>

export const assignmentSchema = z.object({
  pastorId: z.string().min(1, "Seleccioná un pastor"),
  districtId: z.string().min(1, "Seleccioná un distrito"),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
})
export type AssignmentInput = z.infer<typeof assignmentSchema>

const currentYear = new Date().getFullYear()

export const statisticSchema = z
  .object({
    churchId: z.string().min(1),
    period: z.enum(["ANNUAL", "MONTHLY"]),
    year: z.coerce.number().int().min(1900).max(currentYear + 1),
    month: z.coerce.number().int().min(1).max(12).optional().nullable(),
    memberCount: z.coerce.number().int().min(0, "No puede ser negativo"),
    baptismCount: z.coerce.number().int().min(0, "No puede ser negativo"),
  })
  .refine((v) => (v.period === "MONTHLY" ? v.month != null : true), {
    message: "El mes es obligatorio para registros mensuales",
    path: ["month"],
  })
export type StatisticInput = z.infer<typeof statisticSchema>
