"use client"

import { COWORK_DEPARTMENT_PATTERN } from "@cortex/types"
import { Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Check, ChevronsUpDown, CornerDownRight, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

// Reusable department-tree selectors for cortex-config forms. Departments are
// slash paths ("finanse/kontroling"); lexicographic sort puts parents before
// children, so an indent-by-depth list reads as the tree.

function depth(path: string): number {
  return path.split("/").length - 1
}

function lastSegment(path: string): string {
  return path.split("/").at(-1) ?? path
}

interface DepartmentSelectProps {
  departments: string[]
  value: string
  onChange: (next: string) => void
  /** Defaults to the "choose a department" prompt from the cortex-config namespace. */
  placeholder?: string
  /** Allows typing a brand-new path (created implicitly on save). */
  allowCreate?: boolean
}

/** Popup selector: pick one department from the tree (or type a new path). */
export function DepartmentSelect({
  departments,
  value,
  onChange,
  placeholder,
  allowCreate = true,
}: DepartmentSelectProps) {
  const { t } = useTranslation("cortex-config")
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const sorted = [...departments].sort()
  const draftValid = COWORK_DEPARTMENT_PATTERN.test(draft.trim().toLowerCase())

  const pick = (dept: string) => {
    onChange(dept)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="font-mono text-xs">{value}</span>
          ) : (
            <span className="text-muted-foreground">
              {placeholder ?? t("pickers.selectDepartment")}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        <div className="max-h-56 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("pickers.noDepartments")}
            </p>
          ) : (
            sorted.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => pick(dept)}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                style={{ paddingLeft: 8 + depth(dept) * 14 }}
                title={dept}
              >
                {depth(dept) > 0 ? (
                  <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="font-mono text-xs">{lastSegment(dept)}</span>
                {value === dept ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </button>
            ))
          )}
        </div>
        {allowCreate ? (
          <form
            className="mt-1 flex gap-1 border-t border-border p-1 pt-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!draftValid) return
              pick(draft.trim().toLowerCase())
              setDraft("")
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("pickers.newPathPlaceholder")}
              className="h-7 font-mono text-xs"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-7"
              disabled={!draftValid}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

interface DepartmentTreeCheckListProps {
  departments: string[]
  value: string[]
  onChange: (next: string[]) => void
  /** Optional per-department meta (e.g. resource count) rendered right-aligned. */
  meta?: (dept: string) => string | null
  /** Defaults to the "no departments" empty state from the cortex-config namespace. */
  emptyText?: string
}

/** Indented checkbox tree over department paths (multi-select of branches). */
export function DepartmentTreeCheckList({
  departments,
  value,
  onChange,
  meta,
  emptyText,
}: DepartmentTreeCheckListProps) {
  const { t } = useTranslation("cortex-config")
  const sorted = [...departments].sort()
  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyText ?? t("pickers.noDepartments")}</p>
    )
  }
  return (
    <div className="rounded-md border">
      {sorted.map((dept) => {
        const checked = value.includes(dept)
        const metaText = meta?.(dept) ?? null
        return (
          <label
            key={dept}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50",
              checked && "bg-accent/40",
            )}
            style={{ paddingLeft: 8 + depth(dept) * 18 }}
            title={dept}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...value, dept] : value.filter((d) => d !== dept))
              }
            />
            {depth(dept) > 0 ? (
              <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="font-mono text-xs">{lastSegment(dept)}</span>
            {metaText ? (
              <span className="ml-auto text-xs text-muted-foreground">{metaText}</span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}
