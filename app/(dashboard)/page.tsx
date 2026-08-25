import { requireSession } from "@/lib/session"
import {
  getDashboardData,
  getDistrictOptions,
  getPastorOptions,
  getChurchOptions,
} from "@/lib/queries"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export const revalidate = 0

export default async function DashboardPage() {
  const session = await requireSession()
  const [data, districtOptions, pastorOptions, churchOptions] = await Promise.all([
    getDashboardData(session.organizationId),
    getDistrictOptions(session.organizationId),
    getPastorOptions(session.organizationId),
    getChurchOptions(session.organizationId),
  ])

  return (
    <DashboardClient
      initialData={data}
      districtOptions={districtOptions}
      pastorOptions={pastorOptions}
      churchOptions={churchOptions}
    />
  )
}
