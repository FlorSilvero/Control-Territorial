/**
 * Single source of truth for the Excel column layouts shared by the import
 * actions, the export/template routes and the import dialogs' preview tables.
 * Keeping them here is what guarantees that a file exported from the app can
 * be edited and re-imported without touching the headers.
 */
export type ColumnSpec = {
  /** Header written to exports and templates. */
  label: string
  /** Extra spellings accepted on import (matched via normalizeHeader). */
  aliases?: readonly string[]
  required?: boolean
}

/** Every header spelling that resolves to this column, label first. */
export function aliasesOf(spec: ColumnSpec): readonly string[] {
  return [spec.label, ...(spec.aliases ?? [])]
}

export function columnLabels(specs: readonly ColumnSpec[]): string[] {
  return specs.map((s) => s.label)
}

export const PASTOR_COLUMNS = [
  { label: "Nombre", aliases: ["Nombres"], required: true },
  { label: "Apellido", aliases: ["Apellidos"], required: true },
  { label: "Email", aliases: ["Correo", "Correo electrónico", "Mail"] },
  { label: "Teléfono", aliases: ["Celular", "Tel"] },
  { label: "Cónyuge", aliases: ["Esposa", "Esposo", "Pareja"] },
  { label: "Hijos", aliases: ["Nombres de los hijos"] },
  { label: "Distrito", aliases: ["Distrito pastoral"] },
  { label: "Fecha inicio", aliases: ["Fecha de inicio", "Inicio", "Desde"] },
  { label: "Notas", aliases: ["Observaciones", "Comentarios"] },
] as const satisfies readonly ColumnSpec[]

export const PASTOR_EXAMPLE_ROWS: string[][] = [
  [
    "Juan",
    "Pérez",
    "juan@iglesia.app",
    "+54 9 11 1234-5678",
    "María Gómez",
    "Ana, Pedro",
    "Norte",
    "2026-01-15",
    "",
  ],
]

export const STATISTIC_COLUMNS = [
  { label: "Distrito", aliases: ["Distrito pastoral"], required: true },
  { label: "Iglesia", aliases: ["Congregación", "Templo"], required: true },
  { label: "Año", aliases: ["Anio", "Year"], required: true },
  { label: "Mes", aliases: ["Month"], required: true },
  { label: "Miembros", aliases: ["Membresía", "Feligreses"] },
  { label: "Bautismos", aliases: ["Bautizos"] },
] as const satisfies readonly ColumnSpec[]

export const STATISTIC_EXAMPLE_ROWS: string[][] = [
  ["Norte", "Central", "2026", "7", "120", "3"],
  ["Norte", "Central", "2026", "8", "", "1"],
]

/**
 * The "Distritos <año>" planilla: one row per congregation, carrying the whole
 * territorial structure (responsable → distrito → congregación) plus its
 * membership. Unlike STATISTIC_COLUMNS, this layout has no date columns — the
 * whole sheet is a single snapshot, and the month it belongs to is chosen when
 * importing.
 */
export const ROSTER_COLUMNS = [
  {
    label: "Responsable del distrito",
    aliases: ["Responsable", "Pastor", "Pastor responsable", "Pastor del distrito"],
    required: true,
  },
  { label: "Distrito", aliases: ["Distrito pastoral"], required: true },
  {
    label: "Nombre de la Iglesia",
    aliases: ["Iglesia", "Congregación", "Nombre de la congregación", "Templo"],
    required: true,
  },
  { label: "Tipo de Congregacion", aliases: ["Tipo", "Tipo de congregación"] },
  { label: "Miembros", aliases: ["Membresía", "Feligreses"] },
] as const satisfies readonly ColumnSpec[]

export const ROSTER_EXAMPLE_ROWS: string[][] = [
  ["Cerdá Pissano Nestor Gabriel", "Avellaneda", "Avellaneda", "Iglesia", "316"],
  ["Cerdá Pissano Nestor Gabriel", "Avellaneda", "Quilmes", "Iglesia", "92"],
  ["Caviglione Darío Marcelo", "Boedo", "Bajo Flores Sur", "Grupo", "56"],
]

/**
 * The 12 month columns of the "Bautismos <año>" planilla, in sheet order.
 * Index + 1 is the month number, so the position in this array is what maps a
 * column to StatisticRecord.month.
 */
export const MONTH_COLUMNS = [
  { label: "Ene", aliases: ["Enero", "1"] },
  { label: "Feb", aliases: ["Febrero", "2"] },
  { label: "Mar", aliases: ["Marzo", "3"] },
  { label: "Abr", aliases: ["Abril", "4"] },
  { label: "Mayo", aliases: ["May", "5"] },
  { label: "Jun", aliases: ["Junio", "6"] },
  { label: "Jul", aliases: ["Julio", "7"] },
  { label: "Ago", aliases: ["Agosto", "8"] },
  { label: "Set", aliases: ["Sep", "Sept", "Setiembre", "Septiembre", "9"] },
  { label: "Oct", aliases: ["Octubre", "10"] },
  { label: "Nov", aliases: ["Noviembre", "11"] },
  { label: "Dic", aliases: ["Diciembre", "12"] },
] as const satisfies readonly ColumnSpec[]

/**
 * The "Bautismos <año>" planilla: one row per district, one column per month,
 * one sheet per year. Unlike STATISTIC_COLUMNS (one row per church *and*
 * month), this is the layout the entity actually keeps its baptism history in,
 * so it can be exported, edited in Excel and imported back unchanged.
 *
 * Responsable, Total, Blanco and % are written on export for the sheet to read
 * like the original planilla, and ignored on import: the first two are derived
 * from data the app already has, and the app has nowhere to store a goal.
 */
export const BAPTISM_MATRIX_COLUMNS = [
  { label: "Distrito", aliases: ["Distrito pastoral"], required: true },
  { label: "Responsable", aliases: ["Pastor", "Pastor responsable"] },
  ...MONTH_COLUMNS,
  { label: "Total", aliases: ["Total del año"] },
  { label: "Blanco", aliases: ["Meta", "Objetivo"] },
  { label: "%", aliases: ["Porcentaje"] },
] as const satisfies readonly ColumnSpec[]

/**
 * Accepted on import but never exported: it lets a single-sheet file say which
 * year each row belongs to when the sheet isn't named "Bautismos <año>".
 */
export const BAPTISM_YEAR_COLUMN = {
  label: "Año",
  aliases: ["Anio", "Year", "Ejercicio"],
} as const satisfies ColumnSpec

export const BAPTISM_MATRIX_EXAMPLE_ROWS: string[][] = [
  ["Avellaneda", "Cerdá Pissano Nestor Gabriel", "", "3", "", "2", "1", "1", "", "", "3", "8", "7", "25", "20", "125,0%"],
  ["Berazategui", "Maurín, Elías", "", "", "", "2", "1", "", "2", "", "", "", "6", "4", "15", "45", "33,3%"],
]
