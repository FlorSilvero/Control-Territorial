import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function UserMenu({
  name,
  email,
}: {
  name?: string | null
  email?: string | null
  role: string
}) {
  const initials = (name ?? email ?? "U").slice(0, 2).toUpperCase()

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium">
      <Avatar className="size-7">
        <AvatarFallback className="bg-primary/10 text-xs text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="hidden text-sm font-medium sm:inline-block">
        {name ?? email}
      </span>
    </div>
  )
}
