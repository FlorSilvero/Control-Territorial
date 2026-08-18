import { requireSession } from "@/lib/session"
import { Nav } from "@/components/shell/nav"
import { GlobalSearch } from "@/components/shell/global-search"
import { UserMenu } from "@/components/shell/user-menu"
import { Church, Menu } from "lucide-react"
import Link from "next/link"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Church className="size-4" />
          </div>
          <Link href="/" className="font-serif text-lg font-bold tracking-tight">
            Gestión Pastoral
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <Nav />
        </div>
        <div className="border-t p-4">
          <div className="rounded-lg bg-sidebar-accent/50 p-3 text-xs text-sidebar-foreground/70">
            <p className="font-medium text-sidebar-foreground">Sistema Histórico</p>
            <p className="mt-0.5 text-[11px]">Control inmutable de asignaciones y estadísticas.</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Nav */}
            <Sheet>
              <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Menu className="size-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
                <SheetHeader className="h-16 flex-row items-center gap-2 border-b px-6 space-y-0">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Church className="size-4" />
                  </div>
                  <SheetTitle className="font-serif text-lg font-bold">Gestión Pastoral</SheetTitle>
                </SheetHeader>
                <div className="px-4 py-6">
                  <Nav />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/" className="font-serif text-lg font-bold md:hidden">
              Gestión Pastoral
            </Link>
          </div>

          {/* Search + User */}
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <UserMenu name={session.name} email={session.email} role={session.role} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
