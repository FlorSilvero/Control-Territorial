import { requireSession } from "@/lib/session"
import { listDistricts, listChurches, listPastors } from "@/lib/queries"
import { ArchivedClient } from "@/components/archived/archived-client"

export const revalidate = 0

export default async function ArchivedPage() {
  const session = await requireSession()

  const [districts, churches, pastors] = await Promise.all([
    listDistricts(session.organizationId, { archived: true }),
    listChurches(session.organizationId, { archived: true }),
    listPastors(session.organizationId, { archived: true }),
  ])

  return <ArchivedClient data={{ districts, churches, pastors }} />
}
