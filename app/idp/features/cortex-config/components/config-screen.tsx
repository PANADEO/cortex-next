"use client"

import { Button, ErrorState } from "@cortex/ui"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

/** The one access-denied state for every cortex-config admin surface. */
export function AccessDeniedState({ title }: { title?: string }) {
  const { t } = useTranslation("cortex-config")
  return <ErrorState title={title ?? t("access.title")} message={t("access.message")} />
}

interface ConfigScreenProps {
  backHref: string
  backLabel: string
  title: string
  description?: string | undefined
  /**
   * Standard editor footer: renders Anuluj (-> backHref) + a submit button.
   * The submit relies on an enclosing <form>, which every editor screen has.
   */
  save?: { isSaving: boolean; label: string }
  /** Extra header-right actions, rendered before the standard save footer. */
  actions?: ReactNode
  children: ReactNode
}

/** Full-screen scaffold for cortex-config editor routes (popups became screens). */
export function ConfigScreen({
  backHref,
  backLabel,
  title,
  description,
  save,
  actions,
  children,
}: ConfigScreenProps) {
  const { t } = useTranslation("common")
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-6 pb-4 pt-5">
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions || save ? (
            <div className="flex items-center gap-2">
              {actions}
              {save ? (
                <>
                  <Button asChild type="button" variant="outline">
                    <Link href={backHref}>{t("actions.cancel")}</Link>
                  </Button>
                  <Button type="submit" disabled={save.isSaving}>
                    {save.isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {save.label}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">{children}</div>
      </div>
    </div>
  )
}
