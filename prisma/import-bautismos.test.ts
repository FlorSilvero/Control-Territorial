/**
 * Verifica el mapeo de la planilla de bautismos contra el padrón de distritos
 * sin tocar la base: el importador aborta ante cualquiera de estos problemas,
 * así que el test los detecta antes de correrlo.
 */
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { resolveBautismos, type BautismosPayload } from "./data/bautismos-mapeo"
import { DISTRITOS_2026 } from "./data/distritos-2026"

const payload = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "data", "bautismos-historicos.json"), "utf8"),
) as BautismosPayload

// El padrón sembrado, con ids sintéticos: el mapeo sólo mira nombres.
const districts = DISTRITOS_2026.map((d, i) => ({ id: `d${i}`, name: d.name }))
const churches = DISTRITOS_2026.flatMap((d, i) =>
  d.congregations.map((c, j) => ({ id: `c${i}-${j}`, name: c.name, districtId: `d${i}` })),
)

describe("bautismos históricos", () => {
  const { periods, problems } = resolveBautismos(payload.rows, districts, churches)

  it("resuelve cada distrito de la planilla a una congregación", () => {
    expect(problems).toEqual([])
  })

  it("conserva el total de bautismos de cada año", () => {
    const byYear = new Map<number, number>()
    for (const p of periods) byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.baptisms)
    for (const year of payload.meta.years) {
      expect(byYear.get(year) ?? 0, `año ${year}`).toBe(payload.meta.totals[String(year)])
    }
  })

  it("no pisa el snapshot de membresía de septiembre 2026", () => {
    expect(periods.some((p) => p.year === 2026 && p.month === 9)).toBe(false)
  })
})
