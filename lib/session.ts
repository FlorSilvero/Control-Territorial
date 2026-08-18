import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export type SessionContext = {
  userId: string
  organizationId: string
  role: string
  name?: string | null
  email?: string | null
}

/**
 * Resolves the current tenant + user context. Every query in the data layer
 * is scoped by organizationId, so multi-tenancy is a matter of resolving the
 * right org here — no rewrite required when real tenants arrive.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) return null
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  }
}

/** Use in server components / actions that require an authenticated user. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext()
  if (!ctx) redirect("/sign-in")
  return ctx
}

/** Simple role gate, ready to be expanded into a permission matrix. */
export function canEdit(role: string): boolean {
  return role === "ADMIN" || role === "EDITOR"
}
