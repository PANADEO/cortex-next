"use client"

import { cn } from "@cortex/utils"
import { motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, Brain, CheckCircle2, Sparkles, Wrench } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { AgentActivityStep } from "../types"
import { CollapseRegion, DisclosureChevron } from "./disclosure"

// Motion language for the activity surfaces: calm, geometric, no bounce -
// short ease-out fades with a small vertical drift (The Witness, not a
// notification center). All keyframe animations live in tailwind.config.ts.

const EASE_OUT: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

// Gradient-sweep "working" text (paired with animate-shimmer). Shared by the
// active step row and the live block so the class list can't silently diverge.
const SHIMMER_TEXT =
  "animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent motion-reduce:animate-none"

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

/**
 * Claude-Code-style cycling verb, derived from what the agent is doing now.
 * Zwraca KLUCZ, nie napis - `t()` żyje w komponencie, bo tylko tam odświeża
 * się po przełączeniu języka.
 */
function workingLabelKey(steps: AgentActivityStep[]): { key: string; tool: string } {
  const last = steps.at(-1)
  if (!last) return { key: "activity.working.starting", tool: "" }
  switch (last.kind) {
    case "thinking":
    case "thinking_start":
      return { key: "activity.working.thinking", tool: "" }
    case "assistant":
      return { key: "activity.working.answering", tool: "" }
    case "tool_start": {
      const tool = (last.tool ?? "").toLowerCase()
      if (tool.includes("web_search")) return { key: "activity.working.webSearch", tool: "" }
      if (tool.includes("generate_image")) return { key: "activity.working.image", tool: "" }
      if (tool.includes("activate_skill")) return { key: "activity.working.skill", tool: "" }
      if (tool.includes("write") || tool.includes("edit"))
        return { key: "activity.working.write", tool: "" }
      if (tool.includes("read") || tool.includes("list"))
        return { key: "activity.working.read", tool: "" }
      if (tool.includes("bash") || tool.includes("exec") || tool.includes("run"))
        return { key: "activity.working.exec", tool: "" }
      return { key: "activity.working.tool", tool: last.tool ?? "" }
    }
    case "tool_end":
      return { key: "activity.working.toolDone", tool: "" }
    case "lifecycle":
      return { key: "activity.working.lifecycle", tool: "" }
  }
}

/** Jak wyżej: klucz plus podstawienia, tłumaczone dopiero w komponencie. */
function stepLabelKey(step: AgentActivityStep): { key: string; tool: string } {
  switch (step.kind) {
    case "thinking":
    case "thinking_start":
      return { key: "activity.step.thinking", tool: "" }
    case "tool_start":
      return { key: "activity.step.tool", tool: step.tool ?? "?" }
    case "tool_end":
      return { key: "activity.step.toolDone", tool: step.tool ?? "?" }
    case "lifecycle":
      return step.text === "run_start"
        ? { key: "activity.step.runStarted", tool: "" }
        : { key: "activity.step.lifecycle", tool: "" }
    case "assistant":
      return { key: "activity.step.assistant", tool: "" }
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
  const { t } = useTranslation("cortex-cowork")
  const [open, setOpen] = useState(false)
  const reducedMotion = useReducedMotion()
  const drilldown = stepDrilldown(step)
  const label = stepLabelKey(step)

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
              ? cn(SHIMMER_TEXT, "font-medium motion-reduce:text-foreground")
              : "text-muted-foreground",
          )}
        >
          {t(label.key, { tool: label.tool })}
          {active ? "…" : ""}
        </span>
        {drilldown ? (
          <DisclosureChevron open={open} className="ml-auto text-muted-foreground" />
        ) : null}
      </button>
      <CollapseRegion open={open && Boolean(drilldown)}>
        <pre className="ml-6 mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 font-mono text-[11px] leading-snug text-muted-foreground">
          {drilldown}
        </pre>
      </CollapseRegion>
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
  const { t } = useTranslation("cortex-cowork")
  const working = workingLabelKey(steps)
  const workingText = t(working.key, {
    tool: working.tool || t("activity.working.toolFallback"),
  })
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5"
    >
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
        <WorkingGlyph />
        <span key={workingText} className={cn(SHIMMER_TEXT, "motion-reduce:text-muted-foreground")}>
          {workingText}
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
  const { t } = useTranslation("cortex-cowork")
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
        <DisclosureChevron open={open} />
        {t("activity.trail", { count: stepCount })}
      </button>
      <CollapseRegion open={open}>
        <div className="mt-1.5">
          <AgentActivityList steps={steps} />
        </div>
      </CollapseRegion>
    </div>
  )
}
