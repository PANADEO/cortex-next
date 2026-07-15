"use client"

import { Label } from "@cortex/ui"
import type { ReactNode } from "react"

interface InvoiceSupervisorFormFieldProps {
  label: string
  // RHF's `errors.field?.message` is typed `string | undefined` (not just
  // possibly-absent), so this must accept undefined explicitly under
  // exactOptionalPropertyTypes.
  error?: string | undefined
  children: ReactNode
}

export function InvoiceSupervisorFormField({
  label,
  error,
  children,
}: InvoiceSupervisorFormFieldProps) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
