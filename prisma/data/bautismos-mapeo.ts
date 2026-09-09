/**
 * Cómo se traduce la planilla "Bautismos <año>" al modelo de datos de la app.
 *
 * La planilla informa bautismos por DISTRITO y por mes, pero StatisticRecord
 * cuelga de Church. Cada total mensual de un distrito se imputa a su
 * congregación cabecera: la homónima del distrito, o la indicada en
 * DISTRICT_TARGETS cuando no hay homónima o el distrito ya no existe.
 *
 * Aislado del importador para que el test pueda verificar el mapeo completo
 * contra el padrón sin tocar la base.
 */
import { normalizeText } from "../../lib/utils"

export type BautismoRow = {
  year: number
  /** Nombre del distrito tal cual figura en la planilla de ese año. */
  district: string
  responsable: string
  /** Sólo los meses informados: clave "1".."12". */
  months: Record<string, number>
}

export type BautismosPayload = {
  meta: { source: string; extractedAt: string; years: number[]; totals: Record<string, number> }
  rows: BautismoRow[]
}

/**
 * Distritos de la planilla que no resuelven solos: o no existe un distrito con
 * ese nombre, o existe pero no tiene congregación homónima. Clave: nombre en la
 * planilla; valor: distrito y congregación actuales que reciben el dato.
 */
export const DISTRICT_TARGETS: Record<string, { district: string; church: string }> = {
  // Distritos vigentes sin congregación homónima: va a la de mayor membresía.
  "La Costa": { district: "La Costa", church: "San Bernardo" },
  "La Plata Sur": { district: "La Plata Sur", church: "Lisandro Olmos" },
  Laferrere: { district: "Laferrere", church: "Laferrere Centro" },
  "Parque Avellaneda": { district: "Parque Avellaneda", church: "Parque Avellaneda Centro" },
  "San Justo - Liniers": { district: "San Justo - Liniers", church: "San Justo" },
  // Distritos disueltos: hoy son una congregación dentro de otro distrito.
  "San Justo": { district: "San Justo - Liniers", church: "San Justo" },
  Liniers: { district: "San Justo - Liniers", church: "Liniers" },
  "Villa Madero": { district: "San Justo - Liniers", church: "Villa Madero" },
  "Guillermo Hudson": { district: "Berazategui", church: "Guillermo Hudson" },
  Cañuelas: { district: "Monte Grande", church: "Cañuelas" },
  "Costa Atlántica": { district: "La Costa", church: "San Bernardo" }, // nombre viejo de La Costa
  "Moreno - Merlo": { district: "Moreno", church: "Moreno" }, // luego se partió en Moreno y Merlo
  "Merlo Sur": { district: "Merlo", church: "Merlo" },
}

const TARGETS_BY_KEY = new Map(
  Object.entries(DISTRICT_TARGETS).map(([source, target]) => [normalizeText(source), target]),
)

export type DistrictRef = { id: string; name: string }
export type ChurchRef = { id: string; name: string; districtId: string }

/** Un período (iglesia, año, mes) listo para escribir. */
export type ResolvedPeriod = {
  year: number
  month: number
  baptisms: number
  churchId: string
  churchName: string
  districtName: string
  /** Nombre del distrito en la planilla, que puede no ser el actual. */
  sourceDistrict: string
  responsable: string
}

export type ResolveResult = { periods: ResolvedPeriod[]; problems: string[] }

/**
 * Traduce las filas de la planilla a períodos por congregación.
 *
 * Una fila sin ningún mes informado (los distritos que no bautizaron en el año)
 * no genera problema aunque no resuelva: no hay dato que perder. Dos filas del
 * mismo año que caigan en la misma congregación sí lo generan, porque una
 * pisaría a la otra.
 */
export function resolveBautismos(
  rows: BautismoRow[],
  districts: DistrictRef[],
  churches: ChurchRef[],
): ResolveResult {
  const districtsByName = new Map(districts.map((d) => [normalizeText(d.name), d]))
  const churchesByKey = new Map(
    churches.map((c) => [`${c.districtId}|${normalizeText(c.name)}`, c] as const),
  )

  const periods: ResolvedPeriod[] = []
  const problems: string[] = []
  /** `${year}|${churchId}|${month}` -> distrito de origen que ya lo reclamó. */
  const claimed = new Map<string, string>()

  for (const row of rows) {
    const hasData = Object.keys(row.months).length > 0
    const target = TARGETS_BY_KEY.get(normalizeText(row.district)) ?? {
      district: row.district,
      church: row.district, // regla por defecto: la congregación homónima
    }

    const district = districtsByName.get(normalizeText(target.district))
    if (!district) {
      if (hasData) problems.push(`${row.year} "${row.district}": no existe el distrito "${target.district}"`)
      continue
    }
    const church = churchesByKey.get(`${district.id}|${normalizeText(target.church)}`)
    if (!church) {
      if (hasData) {
        problems.push(
          `${row.year} "${row.district}": el distrito "${district.name}" no tiene la congregación "${target.church}"`,
        )
      }
      continue
    }

    for (const [monthKey, baptisms] of Object.entries(row.months)) {
      const month = Number(monthKey)
      const key = `${row.year}|${church.id}|${month}`
      const previous = claimed.get(key)
      if (previous) {
        problems.push(
          `${row.year}/${month}: "${row.district}" y "${previous}" caen en la misma congregación (${district.name} / ${church.name})`,
        )
        continue
      }
      claimed.set(key, row.district)
      periods.push({
        year: row.year,
        month,
        baptisms,
        churchId: church.id,
        churchName: church.name,
        districtName: district.name,
        sourceDistrict: row.district,
        responsable: row.responsable,
      })
    }
  }

  return { periods, problems }
}
