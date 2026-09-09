/**
 * Extrae la planilla "Bautismos <año>" a prisma/data/bautismos-historicos.json,
 * el archivo que consume `npm run import:bautismos`.
 *
 * Uso: npm run extract:bautismos -- "/ruta/a/Bautismos 2010-2026.xlsx"
 *
 * Cada hoja de la planilla es un año: fila 1 título, fila 2 encabezados
 * (Distrito/Responsable en las dos primeras columnas — el orden cambia según el
 * año), columnas 3..14 los doce meses, 15 Total, 16 Blanco, 17 %.
 *
 * La columna "Total" de cada fila NO se usa: en 2026 hay filas cuyo SUM quedó
 * desactualizado (Tandil declara 1 sobre 6 reales). La verificación se hace
 * contra la fila "Total de la Entidad", que sí coincide celda por celda con la
 * suma de los meses; una discrepancia ahí aborta la extracción.
 */
import ExcelJS from "exceljs"
import fs from "node:fs"
import path from "node:path"

/** Años a extraer. Anteriores a 2021 quedan fuera por decisión del usuario. */
const YEARS = [2021, 2022, 2023, 2024, 2025, 2026] as const

const OUT = path.join(import.meta.dirname, "data", "bautismos-historicos.json")

export type BautismoRow = {
  year: number
  /** Nombre del distrito tal cual figura en la planilla de ese año. */
  district: string
  responsable: string
  /** Sólo los meses informados: clave "1".."12". */
  months: Record<string, number>
}

function cellValue(cell: ExcelJS.Cell): unknown {
  let value = cell.value as unknown
  if (value && typeof value === "object" && "richText" in value) {
    value = (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("")
  }
  if (value && typeof value === "object" && "result" in value) {
    value = (value as { result: unknown }).result
  }
  return value
}

function text(cell: ExcelJS.Cell): string {
  const value = cellValue(cell)
  return value == null ? "" : String(value).trim()
}

/** null = celda vacía o "-" (el guion es "sin bautismos", no un dato). */
function num(cell: ExcelJS.Cell): number | null {
  const value = cellValue(cell)
  if (value == null || value === "" || value === "-") return null
  if (typeof value === "number") return value
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

async function main() {
  const source = process.argv[2]
  if (!source) {
    console.error('Uso: npm run extract:bautismos -- "/ruta/Bautismos 2010-2026.xlsx"')
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(source)

  const rows: BautismoRow[] = []
  const totals: Record<string, number> = {}

  for (const year of YEARS) {
    const sheet = workbook.getWorksheet(String(year))
    if (!sheet) throw new Error(`La planilla no tiene la hoja "${year}"`)

    // El orden de las dos primeras columnas se invierte a partir de 2023.
    const districtCol = text(sheet.getRow(2).getCell(1)) === "Distrito" ? 1 : 2
    const responsableCol = districtCol === 1 ? 2 : 1

    const monthSums = new Array(12).fill(0)
    let yearTotal = 0

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return
      const district = text(row.getCell(districtCol))
      if (!district || district.startsWith("Total")) return

      const months: Record<string, number> = {}
      for (let m = 1; m <= 12; m++) {
        const value = num(row.getCell(2 + m))
        if (value === null) continue
        monthSums[m - 1] += value
        yearTotal += value
        if (value !== 0) months[String(m)] = value
      }
      rows.push({ year, district, responsable: text(row.getCell(responsableCol)), months })
    })

    // Fila de control de la planilla.
    const totalRow = sheet.getRow(sheet.rowCount)
    for (let m = 1; m <= 12; m++) {
      const declared = num(totalRow.getCell(2 + m)) ?? 0
      if (declared !== monthSums[m - 1]) {
        throw new Error(
          `${year}: el mes ${m} suma ${monthSums[m - 1]} pero la planilla declara ${declared}`,
        )
      }
    }
    const declaredTotal = num(totalRow.getCell(15))
    if (declaredTotal !== yearTotal) {
      throw new Error(`${year}: total calculado ${yearTotal} != declarado ${declaredTotal}`)
    }
    totals[String(year)] = yearTotal
  }

  const payload = {
    meta: {
      source: path.basename(source),
      extractedAt: new Date().toISOString(),
      years: [...YEARS],
      /** Total de bautismos por año, verificado contra "Total de la Entidad". */
      totals,
    },
    rows,
  }

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n")
  console.log(`[extract] ${rows.length} filas -> ${path.relative(process.cwd(), OUT)}`)
  for (const year of YEARS) console.log(`[extract]   ${year}: ${totals[String(year)]} bautismos`)
}

main()
