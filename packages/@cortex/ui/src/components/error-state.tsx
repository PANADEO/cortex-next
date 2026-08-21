"use client"

import { cn } from "@cortex/utils"
import { AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { Button } from "./ui/button"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation("common")
  return (
    <Alert variant="destructive" className={cn("flex items-start gap-3", className)}>
      <AlertTriangle className="h-4 w-4" />
      <div className="flex-1 space-y-1">
        <AlertTitle>{title ?? t("state.error")}</AlertTitle>
        {message ? <AlertDescription>{message}</AlertDescription> : null}
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            {t("actions.retry")}
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}
