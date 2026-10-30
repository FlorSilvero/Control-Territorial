import { ageInYears, formatBirthDate, retirementStatus, timeToRetirement, RETIREMENT_AGE } from "@/lib/date-utils"
import { cn } from "@/lib/utils"
import { AlertTriangle, Cake } from "lucide-react"

/** Birth date + age, with a red warning when the pastor is near or past RETIREMENT_AGE. */
export function PastorBirthInfo({ birthDate, className }: { birthDate: Date | null | undefined; className?: string }) {
  if (!birthDate) return null
  const status = retirementStatus(birthDate)

  return (
    <div className={cn("space-y-0.5 text-xs", className)}>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Cake className="size-3.5 shrink-0" />
        {formatBirthDate(birthDate)} · {ageInYears(birthDate)} años
      </p>
      {status && (
        <p className="flex items-center gap-1.5 font-medium text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {status === "reached"
            ? `Ya cumplió ${RETIREMENT_AGE} años`
            : `Faltan ${timeToRetirement(birthDate)} para los ${RETIREMENT_AGE}`}
        </p>
      )}
    </div>
  )
}
