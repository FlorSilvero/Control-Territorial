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
      // Only a rejected credential means the user typed something wrong.
      // Anything else — most often the database being unreachable — would
      // otherwise masquerade as a bad password on a login that can never
      // succeed, sending the user off to guess at their own credentials.
      if (error.type === "CredentialsSignin") {
        return { error: "Email o contraseña incorrectos" }
      }
      console.error("[login] fallo ajeno a las credenciales:", error.type, error.cause ?? error)
      return {
        error: "No se pudo conectar con la base de datos. Revisá los logs del servidor.",
      }
    }
    // Next.js redirect throws internally — rethrow so it can complete.
    throw error
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/sign-in" })
}
