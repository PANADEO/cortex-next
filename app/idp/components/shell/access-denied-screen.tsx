"use client"

import { Trans, useTranslation } from "react-i18next"

import { Button } from "@cortex/ui"
import { ShieldAlert } from "lucide-react"
import Image from "next/image"

export type AccessDeniedReason = "denied" | "error"

interface AccessDeniedScreenProps {
  email?: string | null
  reason: AccessDeniedReason
}

export function AccessDeniedScreen({ email, reason }: AccessDeniedScreenProps) {
  const { t } = useTranslation("shell")
  const isError = reason === "error"
  const title = isError ? t("gate.deniedTitle") : t("gate.deniedHeading")

  const handleLogout = () => {
    window.location.assign("/logout")
  }

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card">
          <Image
            src="/cortex-logo.png"
            alt="Cortex360"
            width={28}
            height={28}
            className="dark:hue-rotate-180 dark:invert"
            priority
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {isError ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{t("gate.deniedBody")}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {email ? (
                <Trans
                  t={t}
                  i18nKey="gate.deniedBodyForAccount"
                  values={{ email }}
                  components={{
                    account: <span className="font-medium text-foreground" />,
                  }}
                />
              ) : (
                t("gate.deniedBodyNoAccount")
              )}
            </p>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col gap-2">
          {isError ? (
            <Button onClick={handleRetry} className="w-full">
              {t("gate.retry")}
            </Button>
          ) : (
            <Button onClick={handleLogout} className="w-full">
              {t("gate.signOut")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
