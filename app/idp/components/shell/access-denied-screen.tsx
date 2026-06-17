"use client"

import { Button } from "@cortex/ui"
import { ShieldAlert } from "lucide-react"
import Image from "next/image"

export type AccessDeniedReason = "denied" | "error"

interface AccessDeniedScreenProps {
  email?: string | null
  reason: AccessDeniedReason
}

export function AccessDeniedScreen({ email, reason }: AccessDeniedScreenProps) {
  const isError = reason === "error"
  const title = isError ? "Brak uprawnień" : "Brak dostępu"

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
            className="dark:invert dark:hue-rotate-180"
            priority
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {isError ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nie masz uprawnień do korzystania z tej aplikacji. Skontaktuj się z administratorem.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Twoje konto{" "}
              {email ? (
                <span className="font-medium text-foreground">{email}</span>
              ) : null}{" "}
              nie ma uprawnień do tej aplikacji. Skontaktuj się z administratorem.
            </p>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col gap-2">
          {isError ? (
            <Button onClick={handleRetry} className="w-full">
              Spróbuj ponownie
            </Button>
          ) : (
            <Button onClick={handleLogout} className="w-full">
              Wyloguj się
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
