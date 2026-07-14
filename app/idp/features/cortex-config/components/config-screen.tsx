"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

interface ConfigScreenProps {
  backHref: string
  backLabel: string
  title: string
  description?: string | undefined
  /** Header-right slot - typically Anuluj/Zapisz for editor screens. */
  actions?: ReactNode
  children: ReactNode
}

/** Full-screen scaffold for cortex-config editor routes (popups became screens). */
export function ConfigScreen({
  backHref,
  backLabel,
  title,
  description,
  actions,
  children,
}: ConfigScreenProps) {
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
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">{children}</div>
      </div>
    </div>
  )
}
