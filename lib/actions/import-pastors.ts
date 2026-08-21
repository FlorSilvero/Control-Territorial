"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { pastorSchema } from "@/lib/validations"
import { normalizeText } from "@/lib/utils"
import { readWorkbookRows } from "@/lib/excel"
import { reassignPastorTx } from "@/lib/actions/pastors"
import { audit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }
export type ImportPastorsSummary = {
  created: number
  updated: number
  assigned: number
  errors: ImportRowError[]
}
export type ImportPastorsResult =
  | { ok: true; summary: ImportPastorsSummary }
  | { ok: false; error: string }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Bulk-loads pastors from an .xlsx file (see components/pastors/import-pastors-dialog.tsx
 * for the expected columns). Each row either updates an existing pastor
 * (matched by normalized first+last name, mirroring findDuplicatePastor in
 * pastors.ts) or creates a new one, then optionally assigns them to a
 * district via the same transaction assignPastor uses. Rows are processed
 * independently — one bad row is reported but doesn't abort the file.
 */
export async function importPastors(formData: FormData): Promise<ImportPastorsResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  let rows: Record<string, string>[]
  try {
    rows = await readWorkbookRows(await file.arrayBuffer())
  } catch {
    return { ok: false, error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." }
  }
  if (rows.length === 0) return { ok: false, error: "El archivo no tiene filas de datos" }

  const [pastors, districts] = await Promise.all([
    prisma.pastor.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, firstName: true, lastName: true, archivedAt: true },
    }),
    prisma.district.findMany({
      where: { organizationId: ctx.organizationId, archivedAt: null },
      select: { id: true, name: true },
    }),
  ])

  const errors: ImportRowError[] = []
  let created = 0
  let updated = 0
  let assigned = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // header occupies row 1
    const raw = {
      firstName: row["nombre"] ?? "",
      lastName: row["apellido"] ?? "",
      email: row["email"] ?? row["correo"] ?? row["correo electronico"] ?? "",
      phone: row["telefono"] ?? row["celular"] ?? "",
      notes: row["notas"] ?? row["observaciones"] ?? "",
    }
    const districtName = (row["distrito"] ?? "").trim()
    const startDateText = (row["fecha inicio"] ?? row["fecha de inicio"] ?? "").trim()

    const parsed = pastorSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({ row: rowNum, message: parsed.error.issues[0].message })
      continue
    }
    const { firstName, lastName, email, phone, notes } = parsed.data

    let districtId: string | null = null
    if (districtName) {
      const match = districts.find((d) => normalizeText(d.name) === normalizeText(districtName))
      if (!match) {
        errors.push({ row: rowNum, message: `Distrito no encontrado: "${districtName}"` })
        continue
      }
      districtId = match.id
    }

    let start: Date | null = null
    if (districtId) {
      if (startDateText) {
        const m = startDateText.match(DATE_RE)
        if (!m) {
          errors.push({
            row: rowNum,
            message: `Fecha de inicio inválida: "${startDateText}" (usar AAAA-MM-DD)`,
          })
          continue
        }
        start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      } else {
        start = new Date()
      }
    }

    const existing = pastors.find(
      (p) =>
        normalizeText(p.firstName) === normalizeText(firstName) &&
        normalizeText(p.lastName) === normalizeText(lastName),
    )
    if (existing?.archivedAt) {
      errors.push({
        row: rowNum,
        message: `Ya existe un pastor archivado con ese nombre (${firstName} ${lastName}). Restauralo desde Archivados en lugar de importarlo.`,
      })
      continue
    }

    let pastorId: string
    if (existing) {
      const data: Record<string, string> = {}
      if (email) data.email = email
      if (phone) data.phone = phone
      if (notes) data.notes = notes
      if (Object.keys(data).length > 0) {
        await prisma.pastor.update({ where: { id: existing.id }, data: { ...data, updatedById: ctx.userId } })
      }
      pastorId = existing.id
      updated++
    } else {
      const createdPastor = await prisma.pastor.create({
        data: {
          organizationId: ctx.organizationId,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          createdById: ctx.userId,
          updatedById: ctx.userId,
        },
      })
      pastorId = createdPastor.id
      // Keep the local cache in sync in case the same name repeats later in the file.
      pastors.push({ id: pastorId, firstName, lastName, archivedAt: null })
      created++
    }

    await audit(
      ctx.organizationId,
      ctx.userId,
      existing ? "pastor.import.update" : "pastor.import.create",
      "pastor",
      pastorId,
      { row: rowNum, name: `${firstName} ${lastName}` },
    )

    if (districtId && start) {
      try {
        await prisma.$transaction((tx) =>
          reassignPastorTx(tx, {
            organizationId: ctx.organizationId,
            pastorId,
            districtId: districtId!,
            start: start!,
            createdById: ctx.userId,
          }),
        )
        assigned++
        await audit(ctx.organizationId, ctx.userId, "pastor.import.assign", "pastor", pastorId, {
          row: rowNum,
          districtId,
        })
      } catch {
        errors.push({ row: rowNum, message: "No se pudo asignar el distrito indicado" })
      }
    }
  }

  revalidatePath("/pastors")
  revalidatePath("/districts")
  revalidatePath("/churches")

  return { ok: true, summary: { created, updated, assigned, errors } }
}
