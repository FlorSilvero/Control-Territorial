"use server"

import { requireSession } from "@/lib/session"
import { getDistrictDetail, getPastorDetail, getChurchDetail } from "@/lib/queries"

export type DashboardScope = "district" | "pastor" | "church"

export async function getDashboardScopeData(scope: DashboardScope, id: string) {
  const session = await requireSession()
  if (scope === "district") return getDistrictDetail(session.organizationId, id)
  if (scope === "pastor") return getPastorDetail(session.organizationId, id)
  return getChurchDetail(session.organizationId, id)
}
