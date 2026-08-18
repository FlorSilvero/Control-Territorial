import { requireSession } from "@/lib/session"
import { listPastors, getDistrictOptions, getPastorOptions } from "@/lib/queries"
import { PastorsListClient } from "@/components/pastors/pastors-list-client"

export const revalidate = 0

export default async function PastorsPage() {
  const session = await requireSession()

  const [pastors, districtOptions, pastorOptions] = await Promise.all([
    listPastors(session.organizationId),
    getDistrictOptions(session.organizationId),
    getPastorOptions(session.organizationId),
  ])

  return (
    <PastorsListClient
      pastors={pastors}
      districtOptions={districtOptions}
      pastorOptions={pastorOptions}
    />
  )
}
