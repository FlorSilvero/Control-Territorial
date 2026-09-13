import ExcelJS from "exceljs"
import { normalizeText } from "@/lib/utils"

/** Parse failure with a user-facing (Spanish) message, safe to show as-is. */
export class ExcelReadError extends Error {}

/** Rejected before parsing so a huge upload can't blow up the Node heap. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/** A data row, keyed by normalized header text, plus its real sheet row number. */
export type SheetRow = { rowNumber: number; values: Record<string, string> }

/**
 * Header text as used for lookups: accent- and case-insensitive, with runs of
 * whitespace collapsed and a trailing colon dropped, so "Fecha  Inicio:" and
 * "fecha inicio" resolve to the same column.
 */
export function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ").replace(/:$/, "").trim()
}

/** First value present among `aliases` (already-normalized header names). */
export function pick(values: Record<string, string>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const found = values[normalizeHeader(alias)]
    if (found) return found
  }
  return ""
}

/**
 * Reads the first worksheet of a .xlsx buffer into plain row objects, keyed by
 * normalized header text. The header is the first row that has any content, so
 * blank leading rows are tolerated; every row after it is returned with its
 * real sheet row number, which is what import errors report back to the user.
 *
 * Cell values are stringified and trimmed so callers don't have to deal with
 * ExcelJS's cell-type union (string | number | Date | RichText | formula
 * result | hyperlink | ...).
 */
export async function readWorkbookRows(buffer: ArrayBuffer): Promise<SheetRow[]> {
  const sheet = (await loadedWorkbook(buffer)).worksheets[0]
  if (!sheet) throw new ExcelReadError("El archivo no tiene ninguna hoja de cálculo")
  return sheetRows(sheet)
}

/** One worksheet's rows, plus the sheet name a caller may read a year out of. */
export type NamedSheet = { name: string; rows: SheetRow[] }

/**
 * Same parsing as readWorkbookRows, but across every worksheet instead of just
 * the first. The "Bautismos" planilla keeps one sheet per year, so importing a
 * whole workbook in one upload is the normal case rather than the exception.
 *
 * Sheets whose header row can't be found (a cover page, a blank sheet left
 * behind) come back with no rows instead of aborting the file: it's up to the
 * caller to decide whether an empty sheet matters.
 */
export async function readAllSheetRows(buffer: ArrayBuffer): Promise<NamedSheet[]> {
  const workbook = await loadedWorkbook(buffer)
  const sheets: NamedSheet[] = []
  workbook.eachSheet((sheet) => {
    let rows: SheetRow[] = []
    try {
      rows = sheetRows(sheet)
    } catch {
      rows = []
    }
    sheets.push({ name: sheet.name, rows })
  })
  if (sheets.length === 0) throw new ExcelReadError("El archivo no tiene ninguna hoja de cálculo")
  return sheets
}

/** Shared by both readers: validate the bytes, then hand back a loaded book. */
async function loadedWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  assertReadableXlsx(buffer)

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new ExcelReadError("No se pudo leer el archivo. Verificá que sea un .xlsx válido.")
  }
  return workbook
}

function sheetRows(sheet: ExcelJS.Worksheet): SheetRow[] {
  const headerRowNumber = findHeaderRow(sheet)
  if (headerRowNumber == null) throw new ExcelReadError("El archivo está vacío")

  // First column wins when a header is repeated, so a stray duplicate to the
  // right can't shadow the column the user actually filled in.
  const headers = new Map<number, string>()
  const seen = new Set<string>()
  sheet.getRow(headerRowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cellText(cell.value))
    if (!header || seen.has(header)) return
    seen.add(header)
    headers.set(colNumber, header)
  })
  if (headers.size === 0) throw new ExcelReadError("No se encontró la fila de encabezados")

  const rows: SheetRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return
    const values: Record<string, string> = {}
    let hasContent = false
    headers.forEach((header, colNumber) => {
      const text = cellText(row.getCell(colNumber).value)
      if (text) hasContent = true
      values[header] = text
    })
    if (hasContent) rows.push({ rowNumber, values })
  })

  return rows
}

/**
 * Guards the two failure modes that would otherwise surface as an opaque
 * ExcelJS stack trace: an oversized upload, and a legacy .xls / .csv renamed
 * to .xlsx (a real .xlsx is a ZIP, so it always starts with "PK").
 */
function assertReadableXlsx(buffer: ArrayBuffer): void {
  if (buffer.byteLength === 0) throw new ExcelReadError("El archivo está vacío")
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new ExcelReadError(
      `El archivo supera los ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB permitidos`,
    )
  }

  const magic = new Uint8Array(buffer.slice(0, 4))
  const isOle2 = magic[0] === 0xd0 && magic[1] === 0xcf && magic[2] === 0x11 && magic[3] === 0xe0
  if (isOle2) {
    throw new ExcelReadError(
      "El formato .xls (Excel 97-2003) no es compatible. Abrilo en Excel y guardalo como .xlsx.",
    )
  }
  if (magic[0] !== 0x50 || magic[1] !== 0x4b) {
    throw new ExcelReadError("El archivo no es un .xlsx válido. Guardalo como Libro de Excel (.xlsx).")
  }
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  let found: number | null = null
  sheet.eachRow((row, rowNumber) => {
    if (found != null) return
    let hasContent = false
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cellText(cell.value)) hasContent = true
    })
    if (hasContent) found = rowNumber
  })
  return found
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "1" : "0"
  // ExcelJS decodes serial dates as UTC midnight; read them back in UTC so a
  // negative-offset timezone (like -03) can't shift them to the previous day.
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((t) => t.text).join("").trim()
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue)
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text).trim()
  }
  if (typeof value === "object" && "error" in value) return ""
  return String(value).trim()
}

/** One worksheet of a multi-sheet export. */
export type SheetSpec = {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

/**
 * Builds an in-memory .xlsx workbook from a header row and data rows, with the
 * header frozen and filterable and columns sized to their content so the
 * download is readable without manual resizing.
 */
export async function writeWorkbook(
  headers: string[],
  rows: (string | number)[][],
  sheetName = "Datos",
): Promise<Buffer> {
  return writeSheets([{ name: sheetName, headers, rows }])
}

/**
 * Same as writeWorkbook, but with one worksheet per spec — the shape the
 * "Bautismos" export needs, where each year is its own sheet.
 */
export async function writeSheets(sheets: SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(sheetName(spec.name), {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    sheet.addRow(spec.headers).font = { bold: true }
    for (const row of spec.rows) sheet.addRow(row)

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(spec.headers.length, 1) },
    }
    sheet.columns.forEach((col, index) => {
      const widest = spec.rows.reduce(
        (max, row) => Math.max(max, String(row[index] ?? "").length),
        spec.headers[index]?.length ?? 0,
      )
      col.width = Math.min(Math.max(widest + 2, 8), 50)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Excel rejects sheet names over 31 chars or containing : \ / ? * [ ], and
 * silently corrupts the file rather than reporting it, so names are sanitised
 * here instead of at every call site.
 */
function sheetName(raw: string): string {
  const cleaned = raw.replace(/[:\\/?*[\]]/g, "-").trim()
  return (cleaned || "Datos").slice(0, 31)
}
