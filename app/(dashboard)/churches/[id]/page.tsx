import { notFound } from "next/navigation"
import { requireSession, canEdit } from "@/lib/session"
import { getChurchDetail, getDistrictOptions } from "@/lib/queries"
import { ChurchDetailClient } from "@/components/churches/church-detail-client"

export const revalidate = 0

export default async function ChurchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()

  const [church, districtOptions] = await Promise.all([
    getChurchDetail(session.organizationId, id),
    getDistrictOptions(session.organizationId),
  ])

  if (!church) notFound()

  return (
    <ChurchDetailClient
      church={church}
      districtOptions={districtOptions}
      canEdit={canEdit(session.role)}
    />
  )
}
