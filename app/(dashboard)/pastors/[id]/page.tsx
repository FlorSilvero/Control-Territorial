import { notFound } from "next/navigation"
import { requireSession, canEdit } from "@/lib/session"
import { getPastorDetail, getDistrictOptions, getPastorOptions } from "@/lib/queries"
import { PastorDetailClient } from "@/components/pastors/pastor-detail-client"

export const revalidate = 0

export default async function PastorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()

  const [pastor, districtOptions, pastorOptions] = await Promise.all([
    getPastorDetail(session.organizationId, id),
    getDistrictOptions(session.organizationId),
    getPastorOptions(session.organizationId),
  ])

  if (!pastor) notFound()

  return (
    <PastorDetailClient
      pastor={pastor}
      districtOptions={districtOptions}
      pastorOptions={pastorOptions}
      canEdit={canEdit(session.role)}
    />
  )
}
