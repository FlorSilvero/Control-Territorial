import { describe, it, expect } from "vitest"
import {
  yearFromSheetName,
  parseCount,
  parseMatrixSheets,
  expandPeriods,
  isFuture,
  resolveHeadChurch,
  diffPeriods,
  type MatrixRow,
} from "@/lib/baptism-matrix"
import { readAllSheetRows, writeSheets, type SheetRow } from "@/lib/excel"
import { BAPTISM_MATRIX_COLUMNS, columnLabels } from "@/lib/excel-schemas"

/** A sheet row as readAllSheetRows would hand it over: normalized header keys. */
function row(rowNumber: number, values: Record<string, string>): SheetRow {
  return { rowNumber, values }
}

const NOW = { year: 2026, month: 9 }

describe("yearFromSheetName", () => {
  it("reads the year out of the planilla's sheet names", () => {
    expect(yearFromSheetName("Bautismos 2025")).toBe(2025)
    expect(yearFromSheetName("2021")).toBe(2021)
    expect(yearFromSheetName("Hoja1")).toBeNull()
  })
})

describe("parseCount", () => {
  it("treats blanks and the planilla's dashes as 'nothing written'", () => {
    for (const text of ["", "   ", "-", "–", "—"]) {
      expect(parseCount(text)).toEqual({ ok: true, value: null })
    }
  })

  it("accepts negatives, which the planilla uses to correct an earlier month", () => {
    expect(parseCount("-2")).toEqual({ ok: true, value: -2 })
  })

  it("rejects anything that isn't a whole number", () => {
    expect(parseCount("3,5").ok).toBe(false)
    expect(parseCount("cuatro").ok).toBe(false)
  })
})

describe("parseMatrixSheets", () => {
  it("takes the year from the sheet name and maps each month column by position", () => {
    const { rows, issues } = parseMatrixSheets(
      [
        {
          name: "Bautismos 2025",
          rows: [row(2, { distrito: "Avellaneda", responsable: "Cerdá", feb: "3", dic: "7" })],
        },
      ],
      { fallbackYear: null, maxYear: 2027 },
    )

    expect(issues).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].year).toBe(2025)
    expect(rows[0].responsable).toBe("Cerdá")
    expect(rows[0].months[1]).toBe(3) // Feb
    expect(rows[0].months[11]).toBe(7) // Dic
    expect(rows[0].months[0]).toBeNull() // Ene, en blanco
  })

  it("lets an Año column override the sheet, and falls back when neither says", () => {
    const { rows } = parseMatrixSheets(
      [
        {
          name: "Hoja1",
          rows: [
            row(2, { distrito: "Boedo", ano: "2023", ene: "1" }),
            row(3, { distrito: "Palermo", ene: "2" }),
          ],
        },
      ],
      { fallbackYear: 2024, maxYear: 2027 },
    )

    expect(rows.map((r) => [r.districtName, r.year])).toEqual([
      ["Boedo", 2023],
      ["Palermo", 2024],
    ])
  })

  it("reports the year when neither the sheet, the row nor a fallback has one", () => {
    const { rows, issues } = parseMatrixSheets(
      [{ name: "Hoja1", rows: [row(2, { distrito: "Boedo", ene: "1" })] }],
      { fallbackYear: null, maxYear: 2027 },
    )

    expect(rows).toEqual([])
    expect(issues[0].message).toContain("No se pudo determinar el año")
  })

  it("skips the planilla's 'Total de la Entidad' line", () => {
    const { rows, issues } = parseMatrixSheets(
      [
        {
          name: "Bautismos 2025",
          rows: [
            row(2, { distrito: "Avellaneda", ene: "1" }),
            row(3, { distrito: "Total de la Entidad", ene: "1" }),
          ],
        },
      ],
      { fallbackYear: null, maxYear: 2027 },
    )

    expect(issues).toEqual([])
    expect(rows.map((r) => r.districtName)).toEqual(["Avellaneda"])
  })

  it("reports a month cell that isn't a whole number instead of importing it", () => {
    const { rows, issues } = parseMatrixSheets(
      [{ name: "Bautismos 2025", rows: [row(2, { distrito: "Boedo", mar: "dos" })] }],
      { fallbackYear: null, maxYear: 2027 },
    )

    expect(rows).toEqual([])
    expect(issues[0]).toMatchObject({ sheet: "Bautismos 2025", row: 2 })
    expect(issues[0].message).toContain("Mar")
  })
})

describe("expandPeriods", () => {
  const base: Omit<MatrixRow, "months"> = {
    sheetName: "Bautismos 2025",
    rowNumber: 2,
    districtName: "Avellaneda",
    responsable: "",
    year: 2025,
  }

  it("writes a blank month of a finished year as zero", () => {
    const months = new Array(12).fill(null)
    months[1] = 3
    const { periods, issues } = expandPeriods([{ ...base, months }], NOW)

    expect(issues).toEqual([])
    expect(periods).toHaveLength(12)
    expect(periods.find((p) => p.month === 2)?.baptisms).toBe(3)
    expect(periods.find((p) => p.month === 7)?.baptisms).toBe(0)
  })

  it("ignores blank months that haven't happened yet", () => {
    const months = new Array(12).fill(null)
    months[3] = 6 // Abr, ya pasado
    const { periods } = expandPeriods([{ ...base, year: 2026, months }], NOW)

    expect(periods.map((p) => p.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(periods.find((p) => p.month === 4)?.baptisms).toBe(6)
  })

  it("still honours a number written in a future month", () => {
    const months = new Array(12).fill(null)
    months[10] = 4 // Nov 2026, futuro
    const { periods } = expandPeriods([{ ...base, year: 2026, months }], NOW)

    expect(periods.find((p) => p.month === 11)?.baptisms).toBe(4)
  })

  it("rejects a second row for the same district and year", () => {
    const months = new Array(12).fill(null)
    const { periods, issues } = expandPeriods(
      [
        { ...base, months },
        { ...base, rowNumber: 9, districtName: "AVELLANEDA", months },
      ],
      NOW,
    )

    expect(periods.every((p) => p.rowNumber === 2)).toBe(true)
    expect(issues[0].message).toContain("ya aparece en la fila 2")
  })
})

describe("isFuture", () => {
  it("compares year and month together", () => {
    expect(isFuture({ year: 2026, month: 10 }, NOW)).toBe(true)
    expect(isFuture({ year: 2026, month: 9 }, NOW)).toBe(false)
    expect(isFuture({ year: 2027, month: 1 }, NOW)).toBe(true)
    expect(isFuture({ year: 2025, month: 12 }, NOW)).toBe(false)
  })
})

describe("resolveHeadChurch", () => {
  const churches = [
    { id: "a", name: "Quilmes", members: 92 },
    { id: "b", name: "Avellaneda", members: 40 },
    { id: "c", name: "Wilde", members: 316 },
  ]

  it("prefers the congregation named after the district", () => {
    expect(resolveHeadChurch("Avellaneda", churches)?.id).toBe("b")
  })

  it("falls back to the largest by membership", () => {
    expect(resolveHeadChurch("La Costa", churches)?.id).toBe("c")
  })

  it("breaks a membership tie by name so the choice is stable", () => {
    const tied = [
      { id: "x", name: "Zárate", members: 10 },
      { id: "y", name: "Baradero", members: 10 },
    ]
    expect(resolveHeadChurch("La Costa", tied)?.id).toBe("y")
  })

  it("returns null for a district with no congregations", () => {
    expect(resolveHeadChurch("Nuevo", [])).toBeNull()
  })
})

describe("diffPeriods", () => {
  const period = {
    sheet: "Bautismos 2025",
    rowNumber: 2,
    districtName: "Avellaneda",
    year: 2025,
    month: 2,
    churchId: "c1",
    churchName: "Avellaneda",
  }

  it("only reports the periods whose number actually changes", () => {
    const stored = new Map([
      ["c1|2025|2", 3],
      ["c1|2025|3", 1],
    ])
    const changes = diffPeriods(
      [
        { ...period, baptisms: 3 }, // igual: no es un cambio
        { ...period, month: 3, baptisms: 5 },
        { ...period, month: 4, baptisms: 0 }, // sin registro previo
      ],
      stored,
    )

    expect(changes).toEqual([
      expect.objectContaining({ month: 3, before: 1, after: 5 }),
      expect.objectContaining({ month: 4, before: null, after: 0 }),
    ])
  })
})

describe("round trip through a real .xlsx", () => {
  it("parses back a workbook written with the export's own headers", async () => {
    const headers = columnLabels(BAPTISM_MATRIX_COLUMNS)
    const buffer = await writeSheets([
      {
        name: "Bautismos 2025",
        headers,
        // Distrito, Responsable, Ene..Dic, Total, Blanco, %
        rows: [
          ["Avellaneda", "Cerdá, Néstor", "", 3, "", 2, 1, 1, "", "", 3, 8, 7, "", 25, "", ""],
          ["Total de la Entidad", "", "", 3, "", 2, 1, 1, "", "", 3, 8, 7, "", 25, "", ""],
        ],
      },
      {
        name: "Bautismos 2024",
        headers,
        rows: [["Boedo", "Quiñones, Marcelo", 24, "", "", "", 4, 14, "", 5, 14, 7, 18, 9, 95, "", ""]],
      },
    ])

    const sheets = await readAllSheetRows(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )
    const { rows, issues } = parseMatrixSheets(sheets, { fallbackYear: null, maxYear: 2027 })

    expect(issues).toEqual([])
    expect(rows.map((r) => [r.sheetName, r.districtName, r.year])).toEqual([
      ["Bautismos 2025", "Avellaneda", 2025],
      ["Bautismos 2024", "Boedo", 2024],
    ])
    // Feb=3, Abr=2, Mayo=1, Jun=1, Set=3, Oct=8, Nov=7 — el resto en blanco.
    expect(rows[0].months).toEqual([null, 3, null, 2, 1, 1, null, null, 3, 8, 7, null])

    const { periods } = expandPeriods(rows, NOW)
    const total2025 = periods
      .filter((p) => p.year === 2025)
      .reduce((acc, p) => acc + p.baptisms, 0)
    expect(total2025).toBe(25) // coincide con la columna Total de la planilla
  })
})
