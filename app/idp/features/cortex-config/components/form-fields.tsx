"use client"

import { grantMatches, secretPathGranted } from "@cortex/types"
import { Checkbox } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { useController, type Control, type FieldValues, type Path } from "react-hook-form"
import { DepartmentTreeCheckList } from "./pickers"

// Small form primitives shared by the cortex-config editor screens.

export interface GrantLeaf {
  id: string
  label: string
  /** Department the leaf belongs to; for secrets the id itself is the path. */
  department?: string
}

export interface GrantPickerProps {
  /** Department branch options (checking one pulls everything under it). */
  departments: string[]
  leaves: GrantLeaf[]
  branchValue: string[]
  onBranchChange: (next: string[]) => void
  leafValue: string[]
  onLeafChange: (next: string[]) => void
  leafEmptyText: string
}

/**
 * True when a checked branch already covers the leaf (its own grant is moot).
 * Reuses the canonical grant math so the "covered" marking can't drift from the
 * server-side resolution: department leaves via grantMatches, secret paths (no
 * department) via secretPathGranted.
 */
function coveredByBranch(leaf: GrantLeaf, branches: string[]): boolean {
  const grant = { branches, leaves: [] as string[] }
  return leaf.department
    ? grantMatches(grant, { id: leaf.id, department: leaf.department })
    : secretPathGranted(grant, leaf.id)
}

/**
 * Composition picker for one resource kind: pick department branches (pull all
 * resources under) and/or individual leaves. The two together are the grant.
 * Leaves are grouped by department; ones already covered by a checked branch
 * are marked so the grant reads unambiguously.
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
  const groups = new Map<string, GrantLeaf[]>()
  for (const leaf of leaves) {
    const key = leaf.department ?? ""
    const group = groups.get(key) ?? []
    group.push(leaf)
    groups.set(key, group)
  }
  const groupKeys = [...groups.keys()].sort()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Gałęzie (cały departament)
        </p>
        <DepartmentTreeCheckList
          departments={departments}
          value={branchValue}
          onChange={onBranchChange}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pojedyncze zasoby</p>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">{leafEmptyText}</p>
        ) : (
          <div className="space-y-2">
            {groupKeys.map((key) => (
              <div key={key || "(bez departamentu)"}>
                {key ? (
                  <p className="mb-1 font-mono text-[11px] text-muted-foreground">{key}</p>
                ) : null}
                <div className="space-y-1">
                  {(groups.get(key) ?? []).map((leaf) => {
                    const covered = coveredByBranch(leaf, branchValue)
                    const checked = leafValue.includes(leaf.id)
                    return (
                      <label
                        key={leaf.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm",
                          covered && "opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={checked || covered}
                          disabled={covered}
                          onCheckedChange={(next) =>
                            onLeafChange(
                              next
                                ? [...leafValue, leaf.id]
                                : leafValue.filter((id) => id !== leaf.id),
                            )
                          }
                        />
                        <span className="min-w-0 truncate">{leaf.label}</span>
                        {covered ? (
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                            objęty gałęzią
                          </span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface GrantPickerFieldProps<T extends FieldValues> {
  control: Control<T>
  /** RHF field holding the branch-grant string[] (department paths). */
  branchName: Path<T>
  /** RHF field holding the leaf-grant string[] (resource ids). */
  leafName: Path<T>
  departments: string[]
  leaves: GrantLeaf[]
  leafEmptyText: string
}

/** GrantPicker wired to two RHF fields (branches + leaves) as one grant. */
export function GrantPickerField<T extends FieldValues>({
  control,
  branchName,
  leafName,
  departments,
  leaves,
  leafEmptyText,
}: GrantPickerFieldProps<T>) {
  const branch = useController({ control, name: branchName })
  const leaf = useController({ control, name: leafName })
  return (
    <GrantPicker
      departments={departments}
      leaves={leaves}
      branchValue={branch.field.value as string[]}
      onBranchChange={branch.field.onChange}
      leafValue={leaf.field.value as string[]}
      onLeafChange={leaf.field.onChange}
      leafEmptyText={leafEmptyText}
    />
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
