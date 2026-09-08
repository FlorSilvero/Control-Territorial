"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, canEdit } from "@/lib/session"
import { normalizeText } from "@/lib/utils"
import { readWorkbookRows, pick, ExcelReadError, type SheetRow } from "@/lib/excel"
import { ROSTER_COLUMNS, aliasesOf } from "@/lib/excel-schemas"
import { pastorNameKey, splitRosterPastorName } from "@/lib/pastor-names"
import { pastorSchema } from "@/lib/validations"
import { reassignPastorTx } from "@/lib/actions/pastors"
import { auditMany, type AuditEntry } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type ImportRowError = { row: number; message: string }
export type ImportRosterSummary = {
  districtsCreated: number
  pastorsCreated: number
  assignmentsChanged: number
  churchesCreated: number
  churchesUpdated: number
  statsSaved: number
  /** Capped at MAX_REPORTED_ERRORS; `errorCount` is the real total. */
  errors: ImportRowError[]
  errorCount: number
}
export type ImportRosterResult =
  | { ok: true; summary: ImportRosterSummary }
  | { ok: false; error: string }

const CURRENT_YEAR = new Date().getFullYear()
/** Enough for the user to see the pattern without rendering thousands of rows. */
const MAX_REPORTED_ERRORS = 100
/** Rows per write transaction: bounds both lock time and transaction timeout. */
const CHUNK_SIZE = 200

const COL = Object.fromEntries(ROSTER_COLUMNS.map((c) => [c.label, aliasesOf(c)])) as Record<
  (typeof ROSTER_COLUMNS)[number]["label"],
  readonly string[]
>

type CongregationType = "IGLESIA" | "GRUPO"

/** A district as the file describes it, with the rows that referenced it. */
type PlannedDistrict = {
  name: string
  key: string
  /** Responsable exactly as written in the first row that named this district. */
  pastorLabel: string
  pastorKey: string
  /** Set once the district/pastor stage has run. */
  districtId?: string
  pastorId?: string
}

type PlannedChurch = {
  rowNum: number
  districtKey: string
  name: string
  type: CongregationType
  members: number | null
}

/**
 * Bulk-loads the "Distritos" planilla (column layout: ROSTER_COLUMNS), the
 * sheet that carries the whole territorial structure in one file.
 *
 * Unlike importDistrictStatistics, which only fills in numbers for rows that
 * already exist, this import is structural: a district, responsable or
 * congregation the file names and the app doesn't have gets created, and a
 * congregation whose type changed gets updated. It is an upsert, never a
 * replace — a district or congregation missing from the file is left untouched
 * rather than archived, so a partial sheet can't wipe the database.
 *
 * The sheet has no date columns: `year`/`month` say which monthly snapshot the
 * "Miembros" column belongs to. A blank Miembros cell writes no statistic at
 * all, leaving whatever the app already knows.
 *
 * The file is fully validated before anything is written, so an unresolvable
 * row is reported without aborting the file. Districts, pastors and their
 * assignments are written first — congregations need their ids — and the
 * congregations then follow in chunked transactions.
 */
export async function importRoster(formData: FormData): Promise<ImportRosterResult> {
  const ctx = await requireSession()
  if (!canEdit(ctx.role)) return { ok: false, error: "No autorizado" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Archivo no encontrado" }

  const year = Number(formData.get("year"))
  const month = Number(formData.get("month"))
  if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1) {
    return { ok: false, error: "Año inválido" }
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "Mes inválido" }
  }

  let rawRows: SheetRow[]
  try {
    rawRows = await readWorkbookRows(await file.arrayBuffer())
  } catch (err) {
    if (err instanceof ExcelReadError) return { ok: false, error: err.message }
    return { ok: false, error: "No se pudo leer el archivo. Verificá que sea un .xlsx válido." }
  }
  if (rawRows.length === 0) return { ok: false, error: "El archivo no tiene filas de datos" }

  // Archived rows are loaded too: matching them is what turns "create a second
  // district with the same name" into an actionable "restauralo" error.
  const [districts, pastors, churches] = await Promise.all([
    prisma.district.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, archivedAt: true },
    }),
    prisma.pastor.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, firstName: true, lastName: true, archivedAt: true },
    }),
    prisma.church.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, type: true, districtId: true, archivedAt: true },
    }),
  ])

  const districtsByName = new Map(districts.map((d) => [normalizeText(d.name), d]))

  // A pastor whose written name is ambiguous (two records reduce to the same
  // set of words) can't be resolved from a single cell, so the row is refused
  // instead of silently picking one.
  const pastorsByKey = new Map<string, (typeof pastors)[number]>()
  const ambiguousPastorKeys = new Set<string>()
  for (const p of pastors) {
    const key = pastorNameKey(`${p.firstName} ${p.lastName}`)
    if (pastorsByKey.has(key)) ambiguousPastorKeys.add(key)
    else pastorsByKey.set(key, p)
  }

  const churchesByKey = new Map<string, (typeof churches)[number]>()
  for (const c of churches) {
    const key = `${c.districtId}|${normalizeText(c.name)}`
    if (!churchesByKey.has(key)) churchesByKey.set(key, c)
  }

  const errors: ImportRowError[] = []
  let errorCount = 0
  const fail = (row: number, message: string) => {
    errorCount++
    if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row, message })
  }

  const plannedDistricts = new Map<string, PlannedDistrict>()
  const plannedChurches: PlannedChurch[] = []
  const seenChurches = new Map<string, number>()

  for (const { rowNumber, values } of rawRows) {
    const pastorLabel = pick(values, COL["Responsable del distrito"])
    const districtName = pick(values, COL.Distrito)
    const churchName = pick(values, COL["Nombre de la Iglesia"])
    const typeText = pick(values, COL["Tipo de Congregacion"])
    const membersText = pick(values, COL.Miembros)

    if (!districtName || !churchName) {
      fail(rowNumber, "Distrito y Nombre de la Iglesia son obligatorios")
      continue
    }
    if (!pastorLabel) {
      fail(rowNumber, "Responsable del distrito es obligatorio")
      continue
    }

    const type = parseCongregationType(typeText)
    if (!type) {
      fail(rowNumber, `Tipo de Congregacion inválido: "${typeText}" (usar Iglesia o Grupo)`)
      continue
    }

    let members: number | null = null
    if (membersText) {
      members = Number(membersText)
      if (!Number.isInteger(members) || members < 0) {
        fail(rowNumber, `Miembros inválido: "${membersText}"`)
        continue
      }
    }

    const districtKey = normalizeText(districtName)
    const pastorKey = pastorNameKey(pastorLabel)

    let plan = plannedDistricts.get(districtKey)
    if (plan) {
      // One district has one responsable; disagreeing rows are a data error in
      // the sheet, not something to resolve by last-write-wins.
      if (plan.pastorKey !== pastorKey) {
        fail(
          rowNumber,
          `El distrito "${districtName}" ya figura con otro responsable en este archivo ("${plan.pastorLabel}")`,
        )
        continue
      }
    } else {
      const existingDistrict = districtsByName.get(districtKey)
      if (existingDistrict?.archivedAt) {
        fail(
          rowNumber,
          `El distrito "${districtName}" está archivado. Restauralo desde Archivados antes de importarlo.`,
        )
        continue
      }

      if (ambiguousPastorKeys.has(pastorKey)) {
        fail(rowNumber, `Hay más de un pastor cargado con el nombre "${pastorLabel}"`)
        continue
      }
      const existingPastor = pastorsByKey.get(pastorKey)
      if (existingPastor?.archivedAt) {
        fail(
          rowNumber,
          `El pastor "${pastorLabel}" está archivado. Restauralo desde Archivados antes de importarlo.`,
        )
        continue
      }
      if (!existingPastor) {
        const split = splitRosterPastorName(pastorLabel)
        if (!split) {
          fail(
            rowNumber,
            `No se puede separar nombre y apellido de "${pastorLabel}". Escribilo como "Apellido, Nombre".`,
          )
          continue
        }
        const parsed = pastorSchema.safeParse(split)
        if (!parsed.success) {
          fail(rowNumber, `Responsable inválido ("${pastorLabel}"): ${parsed.error.issues[0].message}`)
          continue
        }
      }

      plan = {
        name: districtName,
        key: districtKey,
        pastorLabel,
        pastorKey,
        districtId: existingDistrict?.id,
        pastorId: existingPastor?.id,
      }
      plannedDistricts.set(districtKey, plan)
    }

    const churchKey = `${districtKey}|${normalizeText(churchName)}`
    const duplicateOf = seenChurches.get(churchKey)
    if (duplicateOf != null) {
      fail(
        rowNumber,
        `"${churchName}" del distrito "${districtName}" ya aparece en la fila ${duplicateOf}`,
      )
      continue
    }

    // Only reachable for a district that already exists — a district created by
    // this same import can't have congregations yet.
    if (plan.districtId) {
      const existingChurch = churchesByKey.get(`${plan.districtId}|${normalizeText(churchName)}`)
      if (existingChurch?.archivedAt) {
        fail(
          rowNumber,
          `La congregación "${churchName}" está archivada. Restaurala desde Archivados antes de importarla.`,
        )
        continue
      }
    }

    seenChurches.set(churchKey, rowNumber)

    plannedChurches.push({ rowNum: rowNumber, districtKey, name: churchName, type, members })
  }

  const summary: ImportRosterSummary = {
    districtsCreated: 0,
    pastorsCreated: 0,
    assignmentsChanged: 0,
    churchesCreated: 0,
    churchesUpdated: 0,
    statsSaved: 0,
    errors,
    errorCount,
  }

  // ---- Stage 1: districts, pastors and their current assignment ----
  // Congregations reference these ids, so this has to land before them.
  const pending = [...plannedDistricts.values()]
  if (pending.length > 0) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = []
          // A pastor may lead more than one district in the same file; create
          // them once and reuse the id for every district that names them.
          const pastorIdByKey = new Map<string, string>()

          for (const plan of pending) {
            if (!plan.districtId) {
              const created = await tx.district.create({
                data: { organizationId: ctx.organizationId, name: plan.name, createdById: ctx.userId, updatedById: ctx.userId },
                select: { id: true },
              })
              plan.districtId = created.id
              summary.districtsCreated++
              entries.push({
                action: "district.import.create",
                entityType: "district",
                entityId: created.id,
                metadata: { name: plan.name },
              })
            }

            const cachedPastorId = plan.pastorId ?? pastorIdByKey.get(plan.pastorKey)
            if (cachedPastorId) {
              plan.pastorId = cachedPastorId
            } else {
              // Already validated during planning, so the split can't be null.
              const split = splitRosterPastorName(plan.pastorLabel)!
              const created = await tx.pastor.create({
                data: {
                  organizationId: ctx.organizationId,
                  firstName: split.firstName,
                  lastName: split.lastName,
                  createdById: ctx.userId,
                  updatedById: ctx.userId,
                },
                select: { id: true },
              })
              plan.pastorId = created.id
              summary.pastorsCreated++
              entries.push({
                action: "pastor.import.create",
                entityType: "pastor",
                entityId: created.id,
                metadata: { name: plan.pastorLabel },
              })
            }
            pastorIdByKey.set(plan.pastorKey, plan.pastorId!)

            // Only reassign when the responsable actually changed: rerunning the
            // same file must not close and reopen an assignment every time,
            // which would fill the district's history with same-pastor periods.
            const active = await tx.pastorAssignment.findFirst({
              where: { districtId: plan.districtId, endDate: null, organizationId: ctx.organizationId },
              select: { pastorId: true },
            })
            if (active?.pastorId !== plan.pastorId) {
              await reassignPastorTx(tx, {
                organizationId: ctx.organizationId,
                pastorId: plan.pastorId!,
                districtId: plan.districtId!,
                start: new Date(year, month - 1, 1),
                createdById: ctx.userId,
              })
              summary.assignmentsChanged++
              entries.push({
                action: "pastor.import.assign",
                entityType: "pastor",
                entityId: plan.pastorId!,
                metadata: { districtId: plan.districtId!, name: plan.pastorLabel },
              })
            }
          }

          await auditMany(tx, ctx.organizationId, ctx.userId, entries)
        },
        { timeout: 60_000, maxWait: 15_000 },
      )
    } catch {
      return { ok: false, error: "No se pudieron guardar los distritos y responsables del archivo" }
    }
  }

  // ---- Stage 2: congregations and their membership snapshot ----
  for (let offset = 0; offset < plannedChurches.length; offset += CHUNK_SIZE) {
    const chunk = plannedChurches.slice(offset, offset + CHUNK_SIZE)
    try {
      const counts = await prisma.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = []
          let created = 0
          let updated = 0
          let stats = 0

          for (const row of chunk) {
            const districtId = plannedDistricts.get(row.districtKey)!.districtId!
            const existing = churchesByKey.get(`${districtId}|${normalizeText(row.name)}`)

            let churchId: string
            if (!existing) {
              const church = await tx.church.create({
                data: {
                  organizationId: ctx.organizationId,
                  districtId,
                  name: row.name,
                  type: row.type,
                  createdById: ctx.userId,
                  updatedById: ctx.userId,
                },
                select: { id: true },
              })
              churchId = church.id
              created++
              entries.push({
                action: "church.import.create",
                entityType: "church",
                entityId: churchId,
                metadata: { row: row.rowNum, name: row.name, type: row.type },
              })
            } else {
              churchId = existing.id
              if (existing.type !== row.type) {
                await tx.church.update({
                  where: { id: churchId },
                  data: { type: row.type, updatedById: ctx.userId },
                })
                updated++
                entries.push({
                  action: "church.import.update",
                  entityType: "church",
                  entityId: churchId,
                  metadata: { row: row.rowNum, name: row.name, type: row.type },
                })
              }
            }

            if (row.members != null) {
              const record = await tx.statisticRecord.upsert({
                where: { churchId_year_month: { churchId, year, month } },
                create: {
                  organizationId: ctx.organizationId,
                  churchId,
                  period: "MONTHLY",
                  year,
                  month,
                  memberCount: row.members,
                  baptismCount: 0,
                  createdById: ctx.userId,
                  updatedById: ctx.userId,
                },
                // The planilla has no baptism column, so an existing record
                // keeps whatever baptisms the app already recorded.
                update: { memberCount: row.members, updatedById: ctx.userId },
                select: { id: true },
              })
              stats++
              entries.push({
                action: "statistic.import",
                entityType: "statisticRecord",
                entityId: record.id,
                metadata: { row: row.rowNum, churchId, year, month, memberCount: row.members },
              })
            }
          }

          await auditMany(tx, ctx.organizationId, ctx.userId, entries)
          return { created, updated, stats }
        },
        { timeout: 60_000, maxWait: 15_000 },
      )
      summary.churchesCreated += counts.created
      summary.churchesUpdated += counts.updated
      summary.statsSaved += counts.stats
    } catch {
      for (const row of chunk) fail(row.rowNum, "No se pudo guardar esta fila")
    }
  }

  summary.errorCount = errorCount

  revalidatePath("/districts")
  revalidatePath("/churches")
  revalidatePath("/pastors")
  revalidatePath("/")

  return { ok: true, summary }
}

/** "Iglesia" / "Grupo" in any casing or accentuation; blank defaults to Iglesia. */
function parseCongregationType(value: string): CongregationType | null {
  if (!value) return "IGLESIA"
  const normalized = normalizeText(value)
  if (normalized === "iglesia") return "IGLESIA"
  if (normalized === "grupo") return "GRUPO"
  return null
}
