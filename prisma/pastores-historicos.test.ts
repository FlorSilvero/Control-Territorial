/**
 * Verifica el historial de responsables contra el padrón de distritos sin tocar
 * la base. Lo que más importa acá es que ningún distrito termine con dos
 * pastores a la vez: la carga aborta ante eso, pero el test lo detecta antes.
 */
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import type { BautismosPayload } from "./data/bautismos-mapeo"
import { resolvePastorAssignments, PASTOR_IDENTITIES } from "./data/pastores-mapeo"
import { DISTRITOS_2026 } from "./data/distritos-2026"

const payload = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "data", "bautismos-historicos.json"), "utf8"),
) as BautismosPayload

const LAST_YEAR = Math.max(...payload.meta.years)
const { periods, problems } = resolvePastorAssignments(
  payload.rows,
  DISTRITOS_2026.map((d) => d.name),
  LAST_YEAR,
)

describe("historial de responsables", () => {
  it("identifica a cada responsable de la planilla", () => {
    expect(problems).toEqual([])
  })

  it("deja exactamente un período vigente por distrito", () => {
    const abiertos = periods.filter((p) => p.toYear === null)
    expect(abiertos).toHaveLength(DISTRITOS_2026.length)
    expect(new Set(abiertos.map((p) => p.district)).size).toBe(DISTRITOS_2026.length)
  })

  it("no solapa dos pastores en el mismo distrito", () => {
    const byDistrict = new Map<string, typeof periods>()
    for (const p of periods) byDistrict.set(p.district, [...(byDistrict.get(p.district) ?? []), p])
    for (const [district, list] of byDistrict) {
      const sorted = [...list].sort((a, b) => a.fromYear - b.fromYear)
      for (let i = 1; i < sorted.length; i++) {
        const previousEnd = sorted[i - 1].toYear ?? LAST_YEAR
        expect(sorted[i].fromYear, `${district}`).toBeGreaterThan(previousEnd)
      }
    }
  })

  it("usa el nombre del padrón para los pastores que siguen en funciones", () => {
    const rostered = new Set(
      DISTRITOS_2026.map((d) => `${d.pastor.lastName}|${d.pastor.firstName}`),
    )
    for (const p of periods.filter((p) => p.toYear === null)) {
      expect(rostered, `${p.district}`).toContain(`${p.pastor.lastName}|${p.pastor.firstName}`)
    }
  })

  it("no deja variantes de nombre sin normalizar a una misma persona", () => {
    // "Menon, Samuel" y "Menón, Samuel" tienen que ser la misma persona.
    const people = new Set(
      Object.values(PASTOR_IDENTITIES).map((n) => `${n.lastName}|${n.firstName}`),
    )
    expect(people.size).toBeLessThan(Object.keys(PASTOR_IDENTITIES).length)
    expect(people.size).toBe(57)
  })
})
