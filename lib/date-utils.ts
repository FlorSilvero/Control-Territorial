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
