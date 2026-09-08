"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, MapPinned, Church, Users, Archive } from "lucide-react"

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/pastors", label: "Pastores", icon: Users },
  { href: "/churches", label: "Iglesias", icon: Church },
  { href: "/districts", label: "Distritos", icon: MapPinned },
  { href: "/archived", label: "Archivados", icon: Archive },
]

const NAV_SECTIONS = [
  { title: null, items: [NAV_ITEMS[0]] },
  { title: "Gestión", items: [NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3]] },
  { title: "Sistema", items: [NAV_ITEMS[4]] },
]

export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-4">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title ?? `section-${index}`} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
