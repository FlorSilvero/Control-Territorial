export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es").format(n)
}

export function pastorInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}
