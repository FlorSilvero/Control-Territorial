import { requireSession, canEdit } from "@/lib/session"
import { listDistricts } from "@/lib/queries"
import { DistrictsListClient } from "@/components/districts/districts-list-client"

export const revalidate = 0

export default async function DistrictsPage() {
  const session = await requireSession()
  const districts = await listDistricts(session.organizationId)

  return <DistrictsListClient districts={districts} canEdit={canEdit(session.role)} />
}
