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
  assertReadableXlsx(buffer)

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new ExcelReadError("No se pudo leer el archivo. Verificá que sea un .xlsx válido.")
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) throw new ExcelReadError("El archivo no tiene ninguna hoja de cálculo")

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
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.addRow(headers).font = { bold: true }
  for (const row of rows) sheet.addRow(row)

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(headers.length, 1) },
  }
  sheet.columns.forEach((col, index) => {
    const widest = rows.reduce(
      (max, row) => Math.max(max, String(row[index] ?? "").length),
      headers[index]?.length ?? 0,
    )
    col.width = Math.min(Math.max(widest + 2, 12), 50)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
