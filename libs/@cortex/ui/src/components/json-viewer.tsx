"use client"

import { cn } from "@cortex/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface JsonViewerProps {
  data: unknown
  initialDepth?: number
  className?: string
}

export function JsonViewer({ data, initialDepth = 2, className }: JsonViewerProps) {
  return (
    <div className={cn("rounded-md border border-border bg-muted/30 p-3 font-mono text-xs", className)}>
      <Node value={data} depth={0} initialDepth={initialDepth} path="$" />
    </div>
  )
}

interface NodeProps {
  value: unknown
  depth: number
  initialDepth: number
  path: string
}

function Node({ value, depth, initialDepth, path }: NodeProps) {
  const [open, setOpen] = useState(depth < initialDepth)

  if (value === null) return <span className="text-muted-foreground">null</span>
  if (typeof value === "string") return <span className="text-success-foreground">&quot;{value}&quot;</span>
  if (typeof value === "number") return <span className="text-info">{value}</span>
  if (typeof value === "boolean") return <span className="text-warning-foreground">{String(value)}</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>
    return (
      <span>
        <Toggle open={open} onToggle={() => setOpen(!open)} label={`[${value.length}]`} />
        {open ? (
          <ul className="ml-4 border-l border-border pl-2">
            {value.map((item, i) => (
              <li key={`${path}.${i}`} className="py-0.5">
                <span className="text-muted-foreground">{i}:</span>{" "}
                <Node value={item} depth={depth + 1} initialDepth={initialDepth} path={`${path}.${i}`} />
              </li>
            ))}
          </ul>
        ) : null}
      </span>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span>{"{}"}</span>
    return (
      <span>
        <Toggle open={open} onToggle={() => setOpen(!open)} label={`{${entries.length}}`} />
        {open ? (
          <ul className="ml-4 border-l border-border pl-2">
            {entries.map(([k, v]) => (
              <li key={`${path}.${k}`} className="py-0.5">
                <span className="text-foreground">{k}:</span>{" "}
                <Node value={v} depth={depth + 1} initialDepth={initialDepth} path={`${path}.${k}`} />
              </li>
            ))}
          </ul>
        ) : null}
      </span>
    )
  }

  return <span>{String(value)}</span>
}

function Toggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
    >
      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      <span>{label}</span>
    </button>
  )
}
