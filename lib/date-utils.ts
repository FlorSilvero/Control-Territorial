export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

/** Human-friendly duration between two dates in years/months (Spanish). */
export function formatDuration(start: Date, end: Date | null): string {
  const to = end ?? new Date()
  let months =
    (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth())
  if (to.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0

  const years = Math.floor(months / 12)
  const rem = months % 12

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? "año" : "años"}`)
  if (rem > 0) parts.push(`${rem} ${rem === 1 ? "mes" : "meses"}`)
  if (parts.length === 0) return "Menos de 1 mes"
  return parts.join(" y ")
}

/** Total months of tenure, used for filtering/sorting pastors. */
export function tenureInMonths(start: Date, end: Date | null): number {
  const to = end ?? new Date()
  let months =
    (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth())
  if (to.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export const RETIREMENT_AGE = 65
/** Pastors this many years (or fewer) away from RETIREMENT_AGE get flagged. */
export const RETIREMENT_WARNING_YEARS = 5

// Birth dates are stored as a plain DATE (UTC midnight), so they are always
// read with UTC getters — local getters would show the day before in Argentina.
function addYearsUTC(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()))
}

export function ageInYears(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getUTCFullYear()
  const beforeBirthday =
    today.getMonth() < birthDate.getUTCMonth() ||
    (today.getMonth() === birthDate.getUTCMonth() && today.getDate() < birthDate.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export function retirementDate(birthDate: Date): Date {
  return addYearsUTC(birthDate, RETIREMENT_AGE)
}

/**
 * "soon" = less than RETIREMENT_WARNING_YEARS left to turn RETIREMENT_AGE;
 * "reached" = already RETIREMENT_AGE or older; null = no flag (or no birth date).
 */
export type RetirementStatus = "soon" | "reached" | null

export function retirementStatus(birthDate: Date | null | undefined, today: Date = new Date()): RetirementStatus {
  if (!birthDate) return null
  const age = ageInYears(birthDate, today)
  if (age >= RETIREMENT_AGE) return "reached"
  if (age >= RETIREMENT_AGE - RETIREMENT_WARNING_YEARS) return "soon"
  return null
}

/** Time left until retirement, e.g. "3 años y 2 meses". */
export function timeToRetirement(birthDate: Date, today: Date = new Date()): string {
  const target = retirementDate(birthDate)
  return formatDuration(today, new Date(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))
}

export function formatBirthDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

/** "YYYY-MM-DD" for a date input, from a stored birth date. */
export function toDateInputValue(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : ""
}
