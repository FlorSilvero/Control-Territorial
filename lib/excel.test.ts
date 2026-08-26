import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { readWorkbookRows, writeWorkbook, normalizeHeader, pick, ExcelReadError } from "@/lib/excel"
import { PASTOR_COLUMNS, PASTOR_EXAMPLE_ROWS, columnLabels } from "@/lib/excel-schemas"

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

async function sheetToArrayBuffer(build: (s: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  build(workbook.addWorksheet("Datos"))
  return toArrayBuffer(Buffer.from(await workbook.xlsx.writeBuffer()))
}

describe("normalizeHeader", () => {
  it("ignores case, accents, extra spaces and a trailing colon", () => {
    expect(normalizeHeader("  Fecha   INICIO: ")).toBe("fecha inicio")
    expect(normalizeHeader("Año")).toBe(normalizeHeader("ANO"))
  })
})

describe("pick", () => {
  it("returns the first alias that has a value", () => {
    const values = { celular: "123" }
    expect(pick(values, ["Teléfono", "Celular"])).toBe("123")
    expect(pick(values, ["Email"])).toBe("")
  })
})

describe("readWorkbookRows", () => {
  it("round-trips a workbook written by writeWorkbook", async () => {
    const buffer = await writeWorkbook(columnLabels(PASTOR_COLUMNS), PASTOR_EXAMPLE_ROWS)
    const rows = await readWorkbookRows(toArrayBuffer(buffer))

    expect(rows).toHaveLength(1)
    expect(rows[0].rowNumber).toBe(2)
    expect(rows[0].values["nombre"]).toBe("Juan")
    expect(rows[0].values["fecha inicio"]).toBe("2026-01-15")
  })

  it("skips blank leading rows and reports real sheet row numbers", async () => {
    const buffer = await sheetToArrayBuffer((s) => {
      s.addRow([])
      s.addRow(["Nombre", "Apellido"])
      s.addRow(["Ana", "Díaz"])
      s.addRow([])
      s.addRow(["Luis", "Paz"])
    })
    const rows = await readWorkbookRows(buffer)

    expect(rows.map((r) => r.rowNumber)).toEqual([3, 5])
    expect(rows[1].values["nombre"]).toBe("Luis")
  })

  it("reads date cells in UTC so a negative-offset timezone can't shift the day", async () => {
    const buffer = await sheetToArrayBuffer((s) => {
      s.addRow(["Fecha inicio"])
      s.addRow([new Date(Date.UTC(2026, 0, 15))])
    })
    const rows = await readWorkbookRows(buffer)

    expect(rows[0].values["fecha inicio"]).toBe("2026-01-15")
  })

  it("reads formula results and numbers as trimmed text", async () => {
    const buffer = await sheetToArrayBuffer((s) => {
      s.addRow(["Miembros", "Bautismos"])
      s.addRow([{ formula: "100+20", result: 120 }, 3])
    })
    const rows = await readWorkbookRows(buffer)

    expect(rows[0].values).toEqual({ miembros: "120", bautismos: "3" })
  })

  it("keeps the leftmost column when a header is repeated", async () => {
    const buffer = await sheetToArrayBuffer((s) => {
      s.addRow(["Nombre", "nombre"])
      s.addRow(["Ana", "Ignorado"])
    })
    const rows = await readWorkbookRows(buffer)

    expect(rows[0].values["nombre"]).toBe("Ana")
  })

  it("rejects legacy .xls with an actionable message", async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer
    await expect(readWorkbookRows(xls)).rejects.toThrowError(/Excel 97-2003/)
  })

  it("rejects anything that isn't a zip container", async () => {
    const csv = new TextEncoder().encode("a,b\n1,2").buffer as ArrayBuffer
    await expect(readWorkbookRows(csv)).rejects.toBeInstanceOf(ExcelReadError)
  })
})
