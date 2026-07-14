"use client"

import { Checkbox } from "@cortex/ui"

// Small form primitives shared by the cortex-config dialogs.

export interface GrantPickerProps {
  /** Department branch options (checking one pulls everything under it). */
  departments: string[]
  /** Individual leaf resources (id + label), optionally shown by department. */
  leaves: Array<{ id: string; label: string; department?: string }>
  branchValue: string[]
  onBranchChange: (next: string[]) => void
  leafValue: string[]
  onLeafChange: (next: string[]) => void
  leafEmptyText: string
}

/**
 * Composition picker for one resource kind: pick department branches (pull all
 * resources under) and/or individual leaves. The two together are the grant.
 */
export function GrantPicker({
  departments,
  leaves,
  branchValue,
  onBranchChange,
  leafValue,
  onLeafChange,
  leafEmptyText,
}: GrantPickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Departamenty (gałęzie)</p>
        <CheckboxList
          options={departments.map((dept) => ({ id: dept, label: dept }))}
          value={branchValue}
          onChange={onBranchChange}
          emptyText="Brak departamentów."
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Pojedyncze zasoby (liście)
        </p>
        <CheckboxList
          options={leaves.map((leaf) => ({
            id: leaf.id,
            label: leaf.label,
            ...(leaf.department ? { hint: leaf.department } : {}),
          }))}
          value={leafValue}
          onChange={onLeafChange}
          emptyText={leafEmptyText}
        />
      </div>
    </div>
  )
}

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
