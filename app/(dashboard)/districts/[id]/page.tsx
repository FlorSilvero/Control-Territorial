import { notFound } from "next/navigation"
import { requireSession, canEdit } from "@/lib/session"
import { getDistrictDetail, getDistrictOptions, getPastorOptions } from "@/lib/queries"
import { DistrictDetailClient } from "@/components/districts/district-detail-client"

export const revalidate = 0

export default async function DistrictDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()

  const [district, districtOptions, pastorOptions] = await Promise.all([
    getDistrictDetail(session.organizationId, id),
    getDistrictOptions(session.organizationId),
    getPastorOptions(session.organizationId),
  ])

  if (!district) notFound()

  return (
    <DistrictDetailClient
      district={district}
      districtOptions={districtOptions}
      pastorOptions={pastorOptions}
      canEdit={canEdit(session.role)}
    />
  )
}
