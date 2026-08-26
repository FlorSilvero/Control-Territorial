/**
 * Per-row import errors. The server caps how many it sends back, so the count
 * is reported separately and the tail is summarised instead of listed.
 */
export function ImportErrorList({
  errors,
  errorCount,
}: {
  errors: { row: number; message: string }[]
  errorCount: number
}) {
  if (errorCount === 0) return null
  const hidden = errorCount - errors.length

  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto text-destructive">
      {errors.map((err, i) => (
        <li key={i}>
          Fila {err.row}: {err.message}
        </li>
      ))}
      {hidden > 0 && <li className="text-muted-foreground">…y {hidden} filas más con error.</li>}
    </ul>
  )
}
