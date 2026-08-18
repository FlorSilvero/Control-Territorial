import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe base config shared by the middleware (proxy.ts) and the full auth
 * setup. It must NOT import Prisma or bcrypt — those are Node-only and would
 * break the Edge runtime the middleware runs in. The Credentials provider that
 * needs them is added in lib/auth.ts only.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string
        token.role = (user as { role?: string }).role
        token.organizationId = (user as { organizationId?: string }).organizationId
      }
      return token
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string
      }
      return session
    },
  },
}
