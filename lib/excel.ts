import ExcelJS from "exceljs"
import { normalizeText } from "@/lib/utils"

/**
 * Reads the first worksheet of a .xlsx buffer into plain row objects, keyed
 * by normalized header text (row 1). Cell values are stringified and
 * trimmed so callers don't have to deal with ExcelJS's cell-type union
 * (string | number | Date | RichText | formula result | ...).
 */
export async function readWorkbookRows(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headerRow = sheet.getRow(1)
  const headers = new Map<number, string>()
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers.set(colNumber, normalizeText(cellText(cell.value)))
  })

  const rows: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values: Record<string, string> = {}
    let hasContent = false
    headers.forEach((header, colNumber) => {
      const text = cellText(row.getCell(colNumber).value)
      if (text) hasContent = true
      values[header] = text
    })
    if (hasContent) rows.push(values)
  })

  return rows
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((t) => t.text).join("").trim()
  }
  if (typeof value === "object" && "result" in value) {
    return cellText(value.result as ExcelJS.CellValue)
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text).trim()
  }
  return String(value).trim()
}

/** Builds an in-memory .xlsx workbook from a header row and data rows. */
export async function writeWorkbook(
  headers: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Datos")
  sheet.addRow(headers).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  sheet.columns.forEach((col) => {
    col.width = 18
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
