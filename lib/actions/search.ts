"use server"

import { requireSession } from "@/lib/session"
import { globalSearch, type SearchResult } from "@/lib/queries"
import { searchQuerySchema } from "@/lib/validations"

export async function searchAction(q: string): Promise<SearchResult[]> {
  const ctx = await requireSession()
  const parsed = searchQuerySchema.safeParse(q)
  if (!parsed.success) return []
  return globalSearch(ctx.organizationId, parsed.data)
}
