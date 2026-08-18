"use server"

import { requireSession } from "@/lib/session"
import { globalSearch, type SearchResult } from "@/lib/queries"

export async function searchAction(q: string): Promise<SearchResult[]> {
  const ctx = await requireSession()
  return globalSearch(ctx.organizationId, q)
}
