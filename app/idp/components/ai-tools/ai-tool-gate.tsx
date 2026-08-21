"use client"

import { canAccessAiTool, hasAnyAiToolAccess, type AiToolId } from "@/lib/ai-tools/app-codes"
import { useAuthorizedApps } from "@cortex/api"
import { Button, EmptyState, LoadingState } from "@cortex/ui"
import { LockKeyhole } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface AiToolGateProps {
  children: ReactNode
  toolId?: AiToolId
}

export function AiToolGate({ children, toolId }: AiToolGateProps) {
  const { t } = useTranslation(["ai-tools", "common"])
  const authorized = useAuthorizedApps()

  if (authorized.isLoading) return <LoadingState label={t("gate.checking")} />

  const allowed = toolId
    ? canAccessAiTool(authorized.apps, toolId)
    : hasAnyAiToolAccess(authorized.apps)

  if (allowed) return <>{children}</>

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <EmptyState
        icon={LockKeyhole}
        title={t("gate.deniedTitle")}
        description={t("gate.deniedBody")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("common:nav.backToHub")}</Link>
          </Button>
        }
      />
    </div>
  )
}
