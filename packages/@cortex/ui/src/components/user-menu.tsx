"use client"

import { LogOut, User as UserIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export interface UserMenuUser {
  email: string
  name?: string | null
  scopes?: readonly string[] | null
}

interface UserMenuProps {
  user: UserMenuUser | null
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || ""
  if (!source) return "·"
  return source[0]!.toUpperCase()
}

export function UserMenu({ user }: UserMenuProps) {
  const isIdpAdmin = user?.scopes?.includes("package_unlock") ?? false

  const handleLogout = () => {
    window.location.assign("/logout")
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
          <UserIcon className="h-4 w-4" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{user?.name ?? user?.email ?? "—"}</p>
              {isIdpAdmin ? (
                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                  IDP admin
                </Badge>
              ) : null}
            </div>
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
