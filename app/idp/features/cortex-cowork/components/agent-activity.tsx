"use client"

import { cn } from "@cortex/utils"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Wrench,
} from "lucide-react"
import { useState } from "react"
import type { AgentActivityStep } from "../types"

// Motion language for the activity surfaces: calm, geometric, no bounce -
// short ease-out fades with a small vertical drift (The Witness, not a
// notification center). All keyframe animations live in tailwind.config.ts.

const EASE_OUT: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

/**
 * The "working" glyph: a circle drawing and undrawing its own stroke in a
 * loop (dashoffset sweep over the full circumference) - a quiet, geometric
 * stand-in for a spinner.
 */
function WorkingGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("h-3.5 w-3.5 shrink-0", className)}>
      <circle cx="8" cy="8" r="5.5" className="stroke-border" strokeWidth="1" />
      <circle
        cx="8"
        cy="8"
        r="5.5"
        className="animate-glyph-draw stroke-cortex motion-reduce:animate-none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="34.6"
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

/** Claude-Code-style cycling verb, derived from what the agent is doing now. */
function workingLabel(steps: AgentActivityStep[]): string {
  const last = steps.at(-1)
  if (!last) return "Rozkręcam sandboxa…"
  switch (last.kind) {
    case "thinking":
    case "thinking_start":
      return "Myślę…"
    case "assistant":
      return "Formułuję odpowiedź…"
    case "tool_start": {
      const tool = (last.tool ?? "").toLowerCase()
      if (tool.includes("web_search")) return "Szukam w sieci…"
      if (tool.includes("generate_image")) return "Generuję obraz…"
      if (tool.includes("activate_skill")) return "Sięgam po skill…"
      if (tool.includes("write") || tool.includes("edit")) return "Piszę plik…"
      if (tool.includes("read") || tool.includes("list")) return "Czytam workspace…"
      if (tool.includes("bash") || tool.includes("exec") || tool.includes("run"))
        return "Wykonuję polecenie…"
      return `Używam: ${last.tool ?? "narzędzia"}…`
    }
    case "tool_end":
      return "Ogarniam wynik…"
    case "lifecycle":
      return "Pracuję w sandboxie…"
  }
}

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
  if (active) return <WorkingGlyph />
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
  const reducedMotion = useReducedMotion()
  const drilldown = stepDrilldown(step)

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="text-xs"
    >
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
        <span
          className={cn(
            "truncate",
            active
              ? "animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text font-medium text-transparent motion-reduce:animate-none motion-reduce:text-foreground"
              : "text-muted-foreground",
          )}
        >
          {stepLabel(step)}
          {active ? "…" : ""}
        </span>
        {drilldown ? (
          <ChevronRight
            className={cn(
              "ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ease-out",
              open && "rotate-90",
            )}
          />
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open && drilldown ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <pre className="ml-6 mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 font-mono text-[11px] leading-snug text-muted-foreground">
              {drilldown}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5"
    >
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
        <WorkingGlyph />
        <span
          key={workingLabel(steps)}
          className="animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:text-muted-foreground"
        >
          {workingLabel(steps)}
        </span>
      </div>
      {steps.length > 0 ? <AgentActivityList steps={steps} live /> : null}
      {liveText ? (
        <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-xs leading-relaxed text-muted-foreground">
          {liveText}
          <span className="ml-0.5 inline-block animate-soft-pulse text-cortex motion-reduce:animate-none">
            ▍
          </span>
        </p>
      ) : null}
    </motion.div>
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
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
        />
        Przebieg pracy agenta ({stepCount} kroków)
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="mt-1.5">
              <AgentActivityList steps={steps} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
