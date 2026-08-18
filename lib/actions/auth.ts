"use server"

import { signIn, signOut } from "@/lib/auth"
import { AuthError } from "next-auth"

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  try {
    await signIn("credentials", { email, password, redirectTo: "/" })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos" }
    }
    // Next.js redirect throws internally — rethrow so it can complete.
    throw error
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/sign-in" })
}
