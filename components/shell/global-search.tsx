"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { searchAction } from "@/lib/actions/search"
import type { SearchResult } from "@/lib/queries"
import { Search, MapPinned, Church, Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

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

const LABELS = {
  district: "Distritos",
  church: "Iglesias",
  pastor: "Pastores",
}

export function GlobalSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search. An empty box needs no state change at all — the dropdown
  // visibility is derived from the query below, so clearing it here would just
  // be a synchronous setState in an effect body triggering a cascading render.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    const handle = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAction(trimmed)
        setResults(r)
        setOpen(true)
        setActiveIndex(-1)
      })
    }, 200)
    return () => clearTimeout(handle)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ⌘K focus
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Stale results from a previous query stay hidden without needing to be
  // cleared: an empty box is never open.
  const isOpen = open && query.trim().length > 0

  const flatResults = results

  const go = (r: SearchResult) => {
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(`${PATHS[r.type]}/${r.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        go(flatResults[activeIndex])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const grouped = (["district", "church", "pastor"] as const).map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0)

  // Build a flat index to know position of each item for keyboard nav
  let flatIndex = 0
  const groupsWithIndex = grouped.map((g) => ({
    ...g,
    items: g.items.map((item) => ({ ...item, flatIdx: flatIndex++ })),
  }))

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim() && results.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar…"
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm shadow-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-all duration-200",
          )}
        />
        {/* Loading / shortcut indicator */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150",
          )}
        >
          {results.length === 0 && !isPending ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {groupsWithIndex.map((group) => (
                <div key={group.type}>
                  {/* Group heading */}
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {LABELS[group.type]}
                    </span>
                  </div>
                  {group.items.map((r) => {
                    const Icon = ICONS[r.type]
                    const isActive = r.flatIdx === activeIndex
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onMouseDown={(e) => {
                          e.preventDefault() // evita que el input pierda foco antes del click
                          go(r)
                        }}
                        onMouseEnter={() => setActiveIndex(r.flatIdx)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{r.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{r.sublabel}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
