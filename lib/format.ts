export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es").format(n)
}

export function pastorInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export type CongregationType = "IGLESIA" | "GRUPO"

export const CONGREGATION_TYPE_LABELS: Record<CongregationType, string> = {
  IGLESIA: "Iglesia",
  GRUPO: "Grupo",
}

export function congregationTypeLabel(type: CongregationType): string {
  return CONGREGATION_TYPE_LABELS[type] ?? CONGREGATION_TYPE_LABELS.IGLESIA
}
