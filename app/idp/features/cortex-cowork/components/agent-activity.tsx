"use client"

import { cn } from "@cortex/utils"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react"
import { useState } from "react"
import type { AgentActivityStep } from "../types"

function stepLabel(step: AgentActivityStep): string {
  switch (step.kind) {
    case "thinking":
    case "thinking_start":
      return "Thinking"
    case "tool_start":
      return `Tool: ${step.tool ?? "?"}`
    case "tool_end":
      return `Tool done: ${step.tool ?? "?"}`
    case "lifecycle":
      return step.text === "run_start" ? "Run started" : (step.text ?? "Lifecycle")
    case "assistant":
      return "Assistant"
  }
}

function stepDrilldown(step: AgentActivityStep): string | null {
  if (step.kind === "thinking") return step.text ?? null
  if (step.detail) return step.detail
  return null
}

function StepIcon({ step, active }: { step: AgentActivityStep; active: boolean }) {
  const className = "h-3.5 w-3.5 shrink-0"
  if (active) return <Loader2 className={cn(className, "animate-spin text-cortex")} />
  switch (step.kind) {
    case "thinking":
    case "thinking_start":
      return <Brain className={cn(className, "text-violet-500")} />
    case "tool_start":
      return <Wrench className={cn(className, "text-amber-500")} />
    case "tool_end":
      return step.isError ? (
        <AlertTriangle className={cn(className, "text-destructive")} />
      ) : (
        <CheckCircle2 className={cn(className, "text-emerald-500")} />
      )
    default:
      return <Sparkles className={cn(className, "text-muted-foreground")} />
  }
}

function ActivityStepRow({ step, active }: { step: AgentActivityStep; active: boolean }) {
  const [open, setOpen] = useState(false)
  const drilldown = stepDrilldown(step)

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => drilldown && setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left",
          drilldown ? "hover:bg-muted/60" : "cursor-default",
          active && "text-foreground",
        )}
      >
        <StepIcon step={step} active={active} />
        <span className={cn("truncate", active ? "font-medium" : "text-muted-foreground")}>
          {stepLabel(step)}
          {active ? "…" : ""}
        </span>
        {drilldown ? (
          open ? (
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : null}
      </button>
      {open && drilldown ? (
        <pre className="ml-6 mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 font-mono text-[11px] leading-snug text-muted-foreground">
          {drilldown}
        </pre>
      ) : null}
    </div>
  )
}

interface AgentActivityListProps {
  steps: AgentActivityStep[]
  /** Marks the last step as in progress (live view during a turn). */
  live?: boolean
}

export function AgentActivityList({ steps, live = false }: AgentActivityListProps) {
  // thinking_start markers are superseded by the consolidated "thinking" step
  // that follows; keep the marker only while it is the live tail.
  const visible = steps.filter(
    (step, index) => step.kind !== "thinking_start" || (live && index === steps.length - 1),
  )
  return (
    <div className="space-y-0.5">
      {visible.map((step, index) => (
        <ActivityStepRow key={step.id} step={step} active={live && index === visible.length - 1} />
      ))}
    </div>
  )
}

interface LiveActivityProps {
  steps: AgentActivityStep[]
  liveText: string
}

/** Live block rendered under the chat while a turn is running. */
export function LiveAgentActivity({ steps, liveText }: LiveActivityProps) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cortex" />
        Pracuję w sandboxie…
      </div>
      {steps.length > 0 ? <AgentActivityList steps={steps} live /> : null}
      {liveText ? (
        <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-xs leading-relaxed text-muted-foreground">
          {liveText}
        </p>
      ) : null}
    </div>
  )
}

interface ActivityTrailProps {
  steps: AgentActivityStep[]
}

/** Collapsed work-trail panel attached to a finished assistant message. */
export function AgentActivityTrail({ steps }: ActivityTrailProps) {
  const [open, setOpen] = useState(false)
  const stepCount = steps.filter((step) => step.kind !== "thinking_start").length
  if (stepCount === 0) return null

  return (
    <div className="mt-2 border-t pt-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Przebieg pracy agenta ({stepCount} kroków)
      </button>
      {open ? (
        <div className="mt-1.5">
          <AgentActivityList steps={steps} />
        </div>
      ) : null}
    </div>
  )
}
