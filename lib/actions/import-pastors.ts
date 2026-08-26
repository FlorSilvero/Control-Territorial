"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { pastorSchema } from "@/lib/validations"
import { normalizeText } from "@/lib/utils"
import { readWorkbookRows, pick, ExcelReadError, type SheetRow } from "@/lib/excel"
import { PASTOR_COLUMNS, aliasesOf } from "@/lib/excel-schemas"
import { reassignPastorTx } from "@/lib/actions/pastors"
import { auditMany, type AuditEntry } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }
export type ImportPastorsSummary = {
  created: number
  updated: number
  assigned: number
  /** Capped at MAX_REPORTED_ERRORS; `errorCount` is the real total. */
  errors: ImportRowError[]
  errorCount: number
}
export type ImportPastorsResult =
  | { ok: true; summary: ImportPastorsSummary }
  | { ok: false; error: string }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** Enough for the user to see the pattern without rendering thousands of rows. */
const MAX_REPORTED_ERRORS = 100
/** Rows per write transaction: bounds both lock time and transaction timeout. */
const CHUNK_SIZE = 100

const COL = Object.fromEntries(PASTOR_COLUMNS.map((c) => [c.label, aliasesOf(c)])) as Record<
  (typeof PASTOR_COLUMNS)[number]["label"],
  readonly string[]
>

type PlannedRow = {
  rowNum: number
  existingId: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  spouseName: string
  childrenNames: string
  notes: string
  districtId: string | null
  start: Date | null
}

/**
 * Bulk-loads pastors from an .xlsx file (column layout: PASTOR_COLUMNS). Each
 * row either updates an existing pastor (matched by normalized first+last
 * name, mirroring findDuplicatePastor in pastors.ts) or creates a new one,
 * then optionally assigns them to a district via the same transaction
 * assignPastor uses.
 *
 * The file is fully validated before anything is written, so a row that can't
 * be resolved is reported without aborting the file; the surviving rows are
 * then written in chunked transactions, which on SQLite turns N commits into
 * N/CHUNK_SIZE and keeps a failure mid-chunk from leaving it half applied.
 */
export async function importPastors(formData: FormData): Promise<ImportPastorsResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  let rows: SheetRow[]
  try {
    rows = await readWorkbookRows(await file.arrayBuffer())
  } catch (err) {
    if (err instanceof ExcelReadError) return { ok: false, error: err.message }
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

  // Normalized-key indexes: the previous linear `find` per row made the import
  // quadratic in the size of the org.
  const pastorsByName = new Map(
    pastors.map((p) => [`${normalizeText(p.firstName)} ${normalizeText(p.lastName)}`, p]),
  )
  const districtsByName = new Map(districts.map((d) => [normalizeText(d.name), d]))

  const errors: ImportRowError[] = []
  let errorCount = 0
  const fail = (row: number, message: string) => {
    errorCount++
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message })
  }

  const plan: PlannedRow[] = []
  const seenNames = new Map<string, number>()

  for (const { rowNumber, values } of rows) {
    const raw = {
      firstName: pick(values, COL.Nombre),
      lastName: pick(values, COL.Apellido),
      email: pick(values, COL.Email),
      phone: pick(values, COL["Teléfono"]),
      spouseName: pick(values, COL["Cónyuge"]),
      childrenNames: pick(values, COL.Hijos),
      notes: pick(values, COL.Notas),
    }
    const districtName = pick(values, COL.Distrito)
    const startDateText = pick(values, COL["Fecha inicio"])

    const parsed = pastorSchema.safeParse(raw)
    if (!parsed.success) {
      fail(rowNumber, parsed.error.issues[0].message)
      continue
    }
    const { firstName, lastName, email, phone, spouseName, childrenNames, notes } = parsed.data

    const nameKey = `${normalizeText(firstName)} ${normalizeText(lastName)}`
    const duplicateOf = seenNames.get(nameKey)
    if (duplicateOf != null) {
      fail(rowNumber, `${firstName} ${lastName} ya aparece en la fila ${duplicateOf} del archivo`)
      continue
    }

    let districtId: string | null = null
    if (districtName) {
      const match = districtsByName.get(normalizeText(districtName))
      if (!match) {
        fail(rowNumber, `Distrito no encontrado: "${districtName}"`)
        continue
      }
      districtId = match.id
    }

    let start: Date | null = null
    if (districtId) {
      if (startDateText) {
        const m = startDateText.match(DATE_RE)
        if (!m) {
          fail(rowNumber, `Fecha de inicio inválida: "${startDateText}" (usar AAAA-MM-DD)`)
          continue
        }
        start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
        if (Number.isNaN(start.getTime()) || start.getMonth() !== Number(m[2]) - 1) {
          fail(rowNumber, `Fecha de inicio inválida: "${startDateText}"`)
          continue
        }
      } else {
        start = new Date()
      }
    }

    const existing = pastorsByName.get(nameKey)
    if (existing?.archivedAt) {
      fail(
        rowNumber,
        `Ya existe un pastor archivado con ese nombre (${firstName} ${lastName}). Restauralo desde Archivados en lugar de importarlo.`,
      )
      continue
    }

    seenNames.set(nameKey, rowNumber)
    plan.push({
      rowNum: rowNumber,
      existingId: existing?.id ?? null,
      firstName,
      lastName,
      email: email ?? "",
      phone: phone ?? "",
      spouseName: spouseName ?? "",
      childrenNames: childrenNames ?? "",
      notes: notes ?? "",
      districtId,
      start,
    })
  }

  let created = 0
  let updated = 0
  let assigned = 0

  for (let offset = 0; offset < plan.length; offset += CHUNK_SIZE) {
    const chunk = plan.slice(offset, offset + CHUNK_SIZE)
    try {
      const counts = await prisma.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = []
          let chunkCreated = 0
          let chunkUpdated = 0
          let chunkAssigned = 0

          for (const row of chunk) {
            let pastorId: string
            if (row.existingId) {
              // Only overwrite the optional fields the file actually filled in,
              // so a partial sheet can't blank out data already in the app.
              const data: Record<string, string> = {}
              if (row.email) data.email = row.email
              if (row.phone) data.phone = row.phone
              if (row.spouseName) data.spouseName = row.spouseName
              if (row.childrenNames) data.childrenNames = row.childrenNames
              if (row.notes) data.notes = row.notes
              if (Object.keys(data).length > 0) {
                await tx.pastor.update({
                  where: { id: row.existingId },
                  data: { ...data, updatedById: ctx.userId },
                })
              }
              pastorId = row.existingId
              chunkUpdated++
            } else {
              const createdPastor = await tx.pastor.create({
                data: {
                  organizationId: ctx.organizationId,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  email: row.email || null,
                  phone: row.phone || null,
                  spouseName: row.spouseName || null,
                  childrenNames: row.childrenNames || null,
                  notes: row.notes || null,
                  createdById: ctx.userId,
                  updatedById: ctx.userId,
                },
                select: { id: true },
              })
              pastorId = createdPastor.id
              chunkCreated++
            }

            entries.push({
              action: row.existingId ? "pastor.import.update" : "pastor.import.create",
              entityType: "pastor",
              entityId: pastorId,
              metadata: { row: row.rowNum, name: `${row.firstName} ${row.lastName}` },
            })

            if (row.districtId && row.start) {
              await reassignPastorTx(tx, {
                organizationId: ctx.organizationId,
                pastorId,
                districtId: row.districtId,
                start: row.start,
                createdById: ctx.userId,
              })
              chunkAssigned++
              entries.push({
                action: "pastor.import.assign",
                entityType: "pastor",
                entityId: pastorId,
                metadata: { row: row.rowNum, districtId: row.districtId },
              })
            }
          }

          await auditMany(tx, ctx.organizationId, ctx.userId, entries)
          return { chunkCreated, chunkUpdated, chunkAssigned }
        },
        { timeout: 60_000, maxWait: 15_000 },
      )
      created += counts.chunkCreated
      updated += counts.chunkUpdated
      assigned += counts.chunkAssigned
    } catch {
      for (const row of chunk) fail(row.rowNum, "No se pudo guardar esta fila")
    }
  }

  revalidatePath("/pastors")
  revalidatePath("/districts")
  revalidatePath("/churches")

  return { ok: true, summary: { created, updated, assigned, errors, errorCount } }
}
