import { normalizeText } from "@/lib/utils"

/**
 * The roster planilla carries the responsable as a single cell in
 * "Apellido(s) Nombre(s)" order, which the app stores split in two. These
 * helpers are the two directions of that conversion, kept together so the
 * export and the import can't drift apart.
 */

/** How a pastor is written back to the roster planilla. */
export function rosterPastorName(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`.trim()
}

/**
 * Order-independent identity of a written name, used to match a roster cell
 * against pastors already in the database. Comparing the *set* of words means
 * "Apellido Nombre", "Nombre Apellido" and "Apellido, Nombre" all resolve to
 * the same existing pastor, so a round-trip through Excel never duplicates one
 * just because the split is ambiguous.
 */
export function pastorNameKey(value: string): string {
  return normalizeText(value)
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

/**
 * Splits a roster cell into first/last name for a pastor that does NOT exist
 * yet. A comma is authoritative ("Apellidos, Nombres"); without one the source
 * planilla's convention applies — the leading word is the surname, or the
 * leading two when the cell has four or more words ("Cerdá Pissano Nestor
 * Gabriel" → Cerdá Pissano / Nestor Gabriel).
 *
 * Returns null when the cell has too few words to split, which the importer
 * reports as a row error rather than guessing.
 */
export function splitRosterPastorName(
  value: string,
): { firstName: string; lastName: string } | null {
  const commaIndex = value.indexOf(",")
  if (commaIndex !== -1) {
    const lastName = value.slice(0, commaIndex).trim()
    const firstName = value.slice(commaIndex + 1).trim()
    if (!lastName || !firstName) return null
    return { firstName, lastName }
  }

  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return null

  const surnameCount = words.length >= 4 ? 2 : 1
  return {
    lastName: words.slice(0, surnameCount).join(" "),
    firstName: words.slice(surnameCount).join(" "),
  }
}
