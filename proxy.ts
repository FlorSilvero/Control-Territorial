import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

// Next.js 16 renames middleware.ts -> proxy.ts. Uses the edge-safe authConfig
// (no Prisma/bcrypt) to gate the whole app behind auth, except the sign-in page
// and Auth.js's own routes.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthed = !!req.auth?.user

  // /api/backup guards itself with a shared secret (see app/api/backup/route.ts) —
  // it's called by the Electron main process, which has no session cookie.
  const isPublic =
    pathname.startsWith("/sign-in") || pathname.startsWith("/api/auth") || pathname.startsWith("/api/backup")

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin))
  }

  if (isAuthed && pathname.startsWith("/sign-in")) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
}
