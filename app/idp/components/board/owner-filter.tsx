"use client"

import { Button, Checkbox, Popover, PopoverContent, PopoverTrigger, Separator } from "@cortex/ui"
import { cn, useFeatureFlag } from "@cortex/utils"
import { Check, UserCog, Users } from "lucide-react"
import { useMemo, useState } from "react"

export const UNASSIGNED = "__unassigned__"

export type OwnerSelection = "all" | ReadonlySet<string>

interface OwnerFilterProps {
  currentUser: string | null
  knownOwners: readonly string[]
  selection: OwnerSelection
  onChange: (next: OwnerSelection) => void
  className?: string
}

function initials(identifier: string): string {
  return (identifier[0] ?? "?").toUpperCase()
}

function describeSelection(
  selection: OwnerSelection,
  currentUser: string | null,
  totalOwners: number,
): string {
  if (selection === "all") return "All owners"
  if (selection.size === 0) return "Nobody"
  if (currentUser && selection.size === 1 && selection.has(currentUser)) return "Just me"
  if (selection.size === 1) {
    const only = [...selection][0]!
    return only === UNASSIGNED ? "Unassigned" : (only.split("@")[0] ?? only)
  }
  if (selection.size === totalOwners + 1) return "All owners"
  return `${selection.size} owners`
}

export function OwnerFilter({
  currentUser,
  knownOwners,
  selection,
  onChange,
  className,
}: OwnerFilterProps) {
  const [open, setOpen] = useState(false)
  const classificationEnabled = useFeatureFlag("idp.classification")

  const options = useMemo(() => {
    const rest = knownOwners.filter((o) => o !== currentUser).sort()
    return { me: currentUser, rest }
  }, [currentUser, knownOwners])

  const isSelected = (value: string) => (selection === "all" ? true : selection.has(value))

  const toggle = (value: string) => {
    const base: Set<string> =
      selection === "all"
        ? new Set([...options.rest, UNASSIGNED, ...(currentUser ? [currentUser] : [])])
        : new Set(selection)
    if (base.has(value)) base.delete(value)
    else base.add(value)
    onChange(base)
  }

  const selectJustMe = () => {
    if (!currentUser) return
    onChange(new Set([currentUser]))
  }

  const selectAll = () => onChange("all")
  const selectNone = () => onChange(new Set())

  const label = describeSelection(selection, currentUser, options.rest.length)
  const isMineActive =
    currentUser != null && selection !== "all" && selection.size === 1 && selection.has(currentUser)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {currentUser ? (
        <Button
          variant={isMineActive ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={isMineActive ? selectAll : selectJustMe}
        >
          <UserCog className="mr-1.5 h-3.5 w-3.5" />
          {isMineActive ? "My view" : "Just me"}
        </Button>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Show packages of
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                All
              </button>
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                None
              </button>
            </div>
          </div>

          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {currentUser ? (
              <OwnerRow
                value={currentUser}
                label={currentUser.split("@")[0] ?? currentUser}
                hint="you"
                checked={isSelected(currentUser)}
                onToggle={() => toggle(currentUser)}
              />
            ) : null}

            {options.rest.length > 0 ? <Separator className="my-1" /> : null}

            {options.rest.map((owner) => (
              <OwnerRow
                key={owner}
                value={owner}
                label={owner.split("@")[0] ?? owner}
                hint={owner}
                checked={isSelected(owner)}
                onToggle={() => toggle(owner)}
              />
            ))}

            <Separator className="my-1" />

            <OwnerRow
              value={UNASSIGNED}
              label="Unassigned"
              hint={classificationEnabled ? "no owner (incl. dirty)" : "no owner"}
              checked={isSelected(UNASSIGNED)}
              onToggle={() => toggle(UNASSIGNED)}
              isMeta
            />
          </div>

          {selection === "all" ? (
            <div className="mt-2 flex items-center gap-1 rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
              <Check className="h-3 w-3" /> All owners included
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function OwnerRow({
  value,
  label,
  hint,
  checked,
  onToggle,
  isMeta = false,
}: {
  value: string
  label: string
  hint: string
  checked: boolean
  onToggle: () => void
  isMeta?: boolean
}) {
  return (
    <label
      htmlFor={`owner-${value}`}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
    >
      <Checkbox id={`owner-${value}`} checked={checked} onCheckedChange={onToggle} />
      {!isMeta ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {initials(value)}
        </span>
      ) : (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
          —
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{label}</span>
        <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}
