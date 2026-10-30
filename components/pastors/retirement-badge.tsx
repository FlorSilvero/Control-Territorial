import { Badge } from "@/components/ui/badge"
import { timeToRetirement, RETIREMENT_AGE } from "@/lib/date-utils"
import { Hourglass } from "lucide-react"

export function RetirementBadge({ status, birthDate }: { status: "soon" | "reached"; birthDate: Date }) {
  if (status === "reached") {
    return (
      <Badge variant="destructive" className="shrink-0 gap-1">
        <Hourglass className="size-3" />
        {RETIREMENT_AGE} años cumplidos
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    >
      <Hourglass className="size-3" />
      Faltan {timeToRetirement(birthDate)} para los {RETIREMENT_AGE}
    </Badge>
  )
}
