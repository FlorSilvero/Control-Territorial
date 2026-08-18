import { redirect } from "next/navigation"
import { getSessionContext } from "@/lib/session"
import { LoginForm } from "@/components/auth/login-form"
import { Church } from "lucide-react"

export default async function SignInPage() {
  const ctx = await getSessionContext()
  if (ctx) redirect("/")

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Church className="size-5" />
          </div>
          <span className="font-serif text-lg font-semibold">Gestión Pastoral</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-balance font-serif text-3xl font-medium leading-tight">
            Distritos, iglesias y pastores con historial completo.
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-sidebar-foreground/70">
            Una plataforma para gestionar la estructura pastoral y sus estadísticas
            históricas de miembros y bautismos, sin perder trazabilidad.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Preparada para múltiples usuarios y organizaciones.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Church className="size-5" />
            </div>
            <span className="font-serif text-lg font-semibold">Gestión Pastoral</span>
          </div>
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-medium">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresá tus credenciales para acceder al panel.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
