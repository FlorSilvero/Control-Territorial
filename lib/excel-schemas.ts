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
