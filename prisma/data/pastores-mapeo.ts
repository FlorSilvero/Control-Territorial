/**
 * Historial de responsables: quién estuvo a cargo de cada distrito, año por año.
 *
 * La planilla trae una columna "Responsable" por año, y la misma persona
 * aparece escrita distinto según el año ("Rivero Dupleich Moisés Elías",
 * "Rivero Dupleich Moisés", "Rivero, Moises"). PASTOR_IDENTITIES resuelve cada
 * grafía a una persona; para los pastores que siguen en el padrón, el nombre
 * canónico es exactamente el de prisma/data/distritos-2026.ts, así que la carga
 * los reconoce en vez de duplicarlos.
 *
 * Los años consecutivos de una misma persona en un mismo distrito se colapsan
 * en un solo período (1 de enero del primer año al 31 de diciembre del último);
 * un corte en el medio abre un período nuevo.
 */
import { normalizeText } from "../../lib/utils"
import type { BautismoRow } from "./bautismos-mapeo"

export type PastorName = { firstName: string; lastName: string }

/**
 * Distritos de la planilla que ya no existen. Por decisión del usuario su
 * historial de responsables no se carga: una asignación cuelga de un distrito,
 * y mandarlos al distrito que los absorbió dejaría varios pastores solapados en
 * el mismo distrito y el mismo año.
 */
export const DISSOLVED_DISTRICTS = [
  "San Justo",
  "Liniers",
  "Villa Madero",
  "Guillermo Hudson",
  "Cañuelas",
  "Costa Atlántica",
  "Moreno - Merlo",
  "Merlo Sur",
]

/**
 * Cada grafía de la planilla -> la persona. Los nombres marcados con "padrón"
 * son los 30 pastores vigentes y están escritos igual que en distritos-2026.ts.
 */
export const PASTOR_IDENTITIES: Record<string, PastorName> = {
  "Aguilar Prat Ariel Matías": { lastName: "Aguilar Prat", firstName: "Ariel Matías" },
  "Aguirre Luna Urrejola Javier": { lastName: "Aguirre Luna Urrejola", firstName: "Javier" },
  "Álvarez Néstor Rubén": { lastName: "Álvarez", firstName: "Néstor Rubén" },
  "Apaza, Daniel": { lastName: "Apaza", firstName: "Daniel" },
  "Badano Javier Alejandro": { lastName: "Badano", firstName: "Javier Alejandro" }, // padrón
  "Barceló, Rubén": { lastName: "Barceló", firstName: "Rubén Darío" }, // padrón
  "Blanco Rivero Martin": { lastName: "Blanco Rivero", firstName: "Martin Marcelo" },
  "Blanco Rivero Martin Marcelo": { lastName: "Blanco Rivero", firstName: "Martin Marcelo" },
  "Boggiano Daniel": { lastName: "Boggiano", firstName: "Daniel" },
  "Britez David Andres": { lastName: "Britez", firstName: "David Andres" },
  "Brizuela David Miguel": { lastName: "Brizuela", firstName: "David Miguel" }, // padrón
  "Cabral Liendro Rubén": { lastName: "Cabral Liendro", firstName: "Rubén Marcelo" },
  "Cabral Liendro Rubén Marcel": { lastName: "Cabral Liendro", firstName: "Rubén Marcelo" },
  "Cabral, Rubén": { lastName: "Cabral Liendro", firstName: "Rubén Marcelo" },
  "Camacho Paredes Cesar Luis": { lastName: "Camacho Paredes", firstName: "Cesar Luis" },
  "Caviglione, Darío": { lastName: "Caviglione", firstName: "Darío Marcelo" }, // padrón
  "Cerdá Pissano Nestor Gabriel": { lastName: "Cerdá Pissano", firstName: "Nestor Gabriel" }, // padrón
  "Cesano Pochyly Alejandro": { lastName: "Cesano Pochyly", firstName: "Alejandro Daniel" },
  "Cesano Pochyly Alejandro Da": { lastName: "Cesano Pochyly", firstName: "Alejandro Daniel" },
  "Costantino Mario Alberto": { lastName: "Costantino", firstName: "Mario Alberto" },
  "D´Acosta Elbio Daniel": { lastName: "D´Acosta", firstName: "Elbio Daniel" },
  "Doni Garcia Julian Matias": { lastName: "Doni Garcia", firstName: "Julian Matias" }, // padrón
  "Doni, Julián": { lastName: "Doni Garcia", firstName: "Julian Matias" }, // padrón
  "Escandriolo, Darío": { lastName: "Escandriolo", firstName: "Darío" },
  "Felker Santiago Ezequiel": { lastName: "Felker", firstName: "Santiago Ezequiel" },
  "Figueroa Jorge César": { lastName: "Figueroa", firstName: "Jorge César" },
  "Figueroa Solano Oliver": { lastName: "Figueroa Solano", firstName: "Oliver" },
  "Fornés, Santiago": { lastName: "Fornes", firstName: "Santiago" }, // padrón
  "Gamarra Navarro, Alvaro Iván": { lastName: "Gamarra Navarro", firstName: "Alvaro Iván" }, // padrón
  "Gandur, Nicolas": { lastName: "Gandur", firstName: "Nicolás" },
  "Gandur, Nicolás": { lastName: "Gandur", firstName: "Nicolás" },
  "Giordana Roberto": { lastName: "Giordana", firstName: "Roberto" },
  "Gonzalez Norberto Luis": { lastName: "Gonzalez", firstName: "Norberto Luis" }, // padrón
  "Hassanie, Emmanuel": { lastName: "Hassanie Iglesias", firstName: "Emmanuel Diego" }, // padrón
  "Heinze, Guillermo": { lastName: "Heinze", firstName: "Guillermo Marcelo" }, // padrón
  "Juchani, Abel": { lastName: "Juchani", firstName: "Abel Isaías" }, // padrón
  "Lapalma Fernando Sebastián": { lastName: "Lapalma", firstName: "Fernando Sebastián" }, // padrón
  "Lapalma, Fernando": { lastName: "Lapalma", firstName: "Fernando Sebastián" }, // padrón
  "Lorenzo, Julián": { lastName: "Lorenzo", firstName: "Julian Daniel" }, // padrón
  "Maldonado Darío Fabián": { lastName: "Maldonado", firstName: "Darío Fabián" },
  "Mammana, Marcelo": { lastName: "Mammana", firstName: "Marcelo Claudio" }, // padrón
  "Martinez, Lucas": { lastName: "Martínez", firstName: "Lucas Esteban" }, // padrón
  "Maurín, Elías": { lastName: "Maurin", firstName: "Leandro Elías" }, // padrón
  "Menon, Samuel": { lastName: "Menón Aranda", firstName: "Samuel Elias" }, // padrón
  "Menón, Samuel": { lastName: "Menón Aranda", firstName: "Samuel Elias" }, // padrón
  "Mun Young Sun": { lastName: "Mun", firstName: "Young Sun" },
  "Olivera Juan Ricardo": { lastName: "Olivera", firstName: "Juan Ricardo" },
  "Panessi, Luis": { lastName: "Panessi Ortiz", firstName: "Cecilio Luis" }, // padrón
  "Perez Sumic Mariano Sebasti": { lastName: "Perez Sumic", firstName: "Mariano Sebastián" },
  "Pino, Lucio": { lastName: "Pino", firstName: "Lucio" },
  "Prado, Guillermo": { lastName: "Prado", firstName: "Guillermo" },
  "Quiñones, Marcelo": { lastName: "Quiñones", firstName: "Marcelo" },
  // La planilla anota la renuncia de Ramos en octubre y el reemplazo por
  // Gigliotti; sólo figura el apellido del reemplazo, así que el período queda
  // a nombre de Ramos. Es un distrito disuelto, de modo que no se carga igual.
  "Ramos R.(renuncia octubre)-Gigliotti": { lastName: "Ramos", firstName: "Raúl" },
  "Ramos, Raúl": { lastName: "Ramos", firstName: "Raúl" },
  "Ramos, Carlos": { lastName: "Ramos Arn", firstName: "Carlos Daniel" }, // padrón
  "Reyes, José": { lastName: "Reyes", firstName: "Jose Santos" }, // padrón
  "Rivero Dupleich Moisés": { lastName: "Rivero Dupleich", firstName: "Moisés Elías" }, // padrón
  "Rivero Dupleich Moisés Elías": { lastName: "Rivero Dupleich", firstName: "Moisés Elías" }, // padrón
  "Rivero, Moises": { lastName: "Rivero Dupleich", firstName: "Moisés Elías" }, // padrón
  "Salinas, Matías": { lastName: "Salinas", firstName: "Matias Diego" }, // padrón
  "Salvo, Bruno": { lastName: "Salvo", firstName: "Bruno Sebastián" }, // padrón
  "Santillan Jorge Eduardo": { lastName: "Santillan", firstName: "Jorge Eduardo" }, // padrón
  "Santillán, Jorge": { lastName: "Santillan", firstName: "Jorge Eduardo" }, // padrón
  "Silva, Federico": { lastName: "Silva", firstName: "Claudio Federico" }, // padrón
  "Stoll Nelson Fabián": { lastName: "Stoll", firstName: "Nelson Fabián" }, // padrón
  "Valenzuela, Tito": { lastName: "Valenzuela", firstName: "Ramon Antonio" }, // padrón ("Tito")
  "Velardo Straface Eduardo": { lastName: "Velardo Straface", firstName: "Eduardo Mauro" }, // padrón
  "Velardo Straface Eduardo Ma": { lastName: "Velardo Straface", firstName: "Eduardo Mauro" }, // padrón
  "Villar, Luciano": { lastName: "Villar", firstName: "Luciano Martín" },
  "Villar, Luciano Martín": { lastName: "Villar", firstName: "Luciano Martín" },
  "Wonki Lee": { lastName: "Lee", firstName: "Wonki" }, // padrón
}

const IDENTITIES_BY_KEY = new Map(
  Object.entries(PASTOR_IDENTITIES).map(([variant, name]) => [normalizeText(variant), name]),
)
const DISSOLVED_BY_KEY = new Set(DISSOLVED_DISTRICTS.map(normalizeText))

export type AssignmentPeriod = {
  district: string
  pastor: PastorName
  /** Primer año del período. */
  fromYear: number
  /** Último año informado; null cuando el período sigue abierto. */
  toYear: number | null
}

export type ResolveAssignmentsResult = { periods: AssignmentPeriod[]; problems: string[] }

/**
 * Arma el historial de asignaciones a partir de la columna "Responsable".
 *
 * `currentDistricts` son los nombres de los distritos vigentes: la planilla los
 * nombra igual salvo mayúsculas y acentos. Un período que llega al último año
 * de la planilla se devuelve con toYear null, porque es la asignación vigente
 * que ya existe en la base y sólo hay que extenderle la fecha de inicio.
 */
export function resolvePastorAssignments(
  rows: BautismoRow[],
  currentDistricts: string[],
  lastYear: number,
): ResolveAssignmentsResult {
  const districtByKey = new Map(currentDistricts.map((name) => [normalizeText(name), name]))
  const problems: string[] = []

  /** `${distrito}|${apellido}|${nombre}` -> años en que estuvo. */
  const yearsByPair = new Map<string, { district: string; pastor: PastorName; years: number[] }>()

  for (const row of rows) {
    if (!row.responsable) continue // 2022 Rafael Calzada viene sin responsable
    if (DISSOLVED_BY_KEY.has(normalizeText(row.district))) continue

    const district = districtByKey.get(normalizeText(row.district))
    if (!district) {
      problems.push(`${row.year}: el distrito "${row.district}" no está entre los vigentes`)
      continue
    }
    const pastor = IDENTITIES_BY_KEY.get(normalizeText(row.responsable))
    if (!pastor) {
      problems.push(`${row.year} "${row.district}": responsable sin identificar: "${row.responsable}"`)
      continue
    }

    const key = `${district}|${pastor.lastName}|${pastor.firstName}`
    const entry = yearsByPair.get(key) ?? { district, pastor, years: [] }
    entry.years.push(row.year)
    yearsByPair.set(key, entry)
  }

  const periods: AssignmentPeriod[] = []
  for (const { district, pastor, years } of yearsByPair.values()) {
    const sorted = [...new Set(years)].sort((a, b) => a - b)
    let start = sorted[0]
    for (let i = 0; i < sorted.length; i++) {
      const isLastOfRun = i === sorted.length - 1 || sorted[i + 1] !== sorted[i] + 1
      if (!isLastOfRun) continue
      const end = sorted[i]
      periods.push({ district, pastor, fromYear: start, toYear: end === lastYear ? null : end })
      start = sorted[i + 1]
    }
  }

  periods.sort(
    (a, b) =>
      a.district.localeCompare(b.district) ||
      a.fromYear - b.fromYear ||
      a.pastor.lastName.localeCompare(b.pastor.lastName),
  )
  return { periods, problems }
}
