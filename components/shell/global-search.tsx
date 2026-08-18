"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { searchAction } from "@/lib/actions/search"
import type { SearchResult } from "@/lib/queries"
import { Search, MapPinned, Church, Users } from "lucide-react"

const ICONS = {
  district: MapPinned,
  church: Church,
  pastor: Users,
}

const PATHS = {
  district: "/districts",
  church: "/churches",
  pastor: "/pastors",
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (!open) return
    const handle = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAction(query)
        setResults(r)
      })
    }, 200)
    return () => clearTimeout(handle)
  }, [query, open])

  const go = (r: SearchResult) => {
    setOpen(false)
    setQuery("")
    router.push(`${PATHS[r.type]}/${r.id}`)
  }

  const grouped = {
    district: results.filter((r) => r.type === "district"),
    church: results.filter((r) => r.type === "church"),
    pastor: results.filter((r) => r.type === "pastor"),
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 text-muted-foreground sm:w-64"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Buscar pastores, distritos o iglesias…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query ? "Sin resultados." : "Escribí para buscar."}
          </CommandEmpty>
          {(["district", "church", "pastor"] as const).map((type) => {
            const items = grouped[type]
            if (items.length === 0) return null
            const Icon = ICONS[type]
            const heading =
              type === "district" ? "Distritos" : type === "church" ? "Iglesias" : "Pastores"
            return (
              <CommandGroup key={type} heading={heading}>
                {items.map((r) => (
                  <CommandItem
                    key={`${r.type}-${r.id}`}
                    value={`${r.type}-${r.id}`}
                    onSelect={() => go(r)}
                    className="gap-2"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.sublabel}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </CommandList>
      </CommandDialog>
    </>
  )
}
