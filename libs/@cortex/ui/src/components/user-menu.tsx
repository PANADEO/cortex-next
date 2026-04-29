"use client"

import { LogOut, User } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

interface UserMenuProps {
  logoutCallbackUrl?: string
  logoutHref?: string | null
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || ""
  if (!source) return "·"
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  if (parts.length === 0) return source.slice(0, 2).toUpperCase()
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

export function UserMenu({ logoutCallbackUrl = "/login", logoutHref = null }: UserMenuProps) {
  const { data: session } = useSession()
  const user = session?.user

  const handleLogout = () => {
    if (logoutHref) {
      // Fire-and-forget NextAuth cookie clear before the full-page redirect.
      // Belt-and-braces: if the user closes the tab mid-chain, the stale
      // NextAuth session is gone too (otherwise valid for the JWT maxAge).
      void signOut({ redirect: false })
      window.location.href = logoutHref
      return
    }
    void signOut({ callbackUrl: logoutCallbackUrl })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">
              {initials(user?.name ?? null, user?.email ?? null)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
