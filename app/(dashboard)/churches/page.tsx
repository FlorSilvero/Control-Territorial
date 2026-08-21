import { requireSession, canEdit } from "@/lib/session"
import { listChurches, getDistrictOptions } from "@/lib/queries"
import { ChurchesListClient } from "@/components/churches/churches-list-client"

export const revalidate = 0

export default async function ChurchesPage() {
  const session = await requireSession()

  const [churches, districtOptions] = await Promise.all([
    listChurches(session.organizationId),
    getDistrictOptions(session.organizationId),
  ])

  return (
    <ChurchesListClient
      churches={churches}
      districtOptions={districtOptions}
      canEdit={canEdit(session.role)}
    />
  )
}
