"use client"

import { canAccessAiTool, hasAnyAiToolAccess, type AiToolId } from "@/lib/ai-tools/app-codes"
import { useAuthorizedApps } from "@cortex/api"
import { Button, EmptyState } from "@cortex/ui"
import { LockKeyhole } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

interface AiToolGateProps {
  children: ReactNode
  toolId?: AiToolId
}

export function AiToolGate({ children, toolId }: AiToolGateProps) {
  const authorized = useAuthorizedApps()

  if (authorized.isLoading) return null

  const allowed = toolId
    ? canAccessAiTool(authorized.apps, toolId)
    : hasAnyAiToolAccess(authorized.apps)

  if (allowed) return <>{children}</>

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <EmptyState
        icon={LockKeyhole}
        title="Brak dostępu do AI Tools"
        description="Twoje konto nie ma włączonej tej aplikacji. Skontaktuj się z administratorem instancji."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">Wróć do huba</Link>
          </Button>
        }
      />
    </div>
  )
}
