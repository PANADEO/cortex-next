"use client"

import { Checkbox } from "@cortex/ui"

// Small form primitives shared by the cortex-config dialogs.

export function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export interface CheckboxListProps {
  options: Array<{ id: string; label: string; hint?: string }>
  value: string[]
  onChange: (next: string[]) => void
  emptyText: string
}

/** Two-column grid of labelled checkboxes editing a string-id array. */
export function CheckboxList({ options, value, onChange, emptyText }: CheckboxListProps) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const checked = value.includes(option.id)
        return (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...value, option.id] : value.filter((id) => id !== option.id))
              }
            />
            <span>
              {option.label}
              {option.hint ? (
                <span className="ml-1 text-xs text-muted-foreground">({option.hint})</span>
              ) : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}
