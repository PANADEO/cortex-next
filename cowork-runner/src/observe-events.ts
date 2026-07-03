import { observe } from "@flue/runtime"

// Live activity feed for the Cortex Cowork tile.
//
// A top-level observe() subscriber maps Flue's runtime observations
// (thinking, tool calls, text progress, lifecycle) to a compact NDJSON
// envelope and writes them to stderr, one line each, prefixed with a marker
// the Next.js side greps for while the `flue run` child process is running:
//
//   @@COWORK_EVT@@{"seq":1,"ts":"...","kind":"tool_start","tool":"bash",...}
//
// stderr is used (not stdout) so the workflow's terminal `{"reply": ...}`
// result parsing stays untouched. Detail payloads are truncated defensively -
// they exist for a UI drilldown, not for archival.

export const EVENT_MARKER = "@@COWORK_EVT@@"

const DETAIL_LIMIT = 4096

export interface CoworkEvent {
  seq: number
  ts: string
  kind: "thinking" | "thinking_start" | "tool_start" | "tool_end" | "assistant" | "lifecycle"
  tool?: string
  detail?: string
  text?: string
  isError?: boolean
}

let seq = 0

function emit(event: Omit<CoworkEvent, "seq" | "ts">): void {
  const payload: CoworkEvent = { seq: ++seq, ts: new Date().toISOString(), ...event }
  process.stderr.write(`${EVENT_MARKER}${JSON.stringify(payload)}\n`)
}

function truncate(value: string): string {
  return value.length > DETAIL_LIMIT ? `${value.slice(0, DETAIL_LIMIT)}\n… [truncated]` : value
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// Thinking arrives as deltas correlated by (turnId, contentIndex); buffer and
// emit one consolidated step per thinking block.
const thinkingBuffers = new Map<string, string>()

function thinkingKey(observation: { turnId?: string; contentIndex?: number }): string {
  return `${observation.turnId ?? "?"}:${observation.contentIndex ?? 0}`
}

observe((observation) => {
  const obs = observation as Record<string, unknown> & { type: string }
  switch (obs.type) {
    case "thinking_start": {
      thinkingBuffers.set(thinkingKey(obs as { turnId?: string; contentIndex?: number }), "")
      emit({ kind: "thinking_start" })
      return
    }
    case "thinking_delta": {
      const key = thinkingKey(obs as { turnId?: string; contentIndex?: number })
      const delta = typeof obs.delta === "string" ? obs.delta : stringify(obs.delta)
      thinkingBuffers.set(key, (thinkingBuffers.get(key) ?? "") + delta)
      return
    }
    case "thinking_end": {
      const key = thinkingKey(obs as { turnId?: string; contentIndex?: number })
      const text = thinkingBuffers.get(key) ?? ""
      thinkingBuffers.delete(key)
      if (text.trim()) emit({ kind: "thinking", text: truncate(text) })
      return
    }
    case "tool_start": {
      emit({
        kind: "tool_start",
        tool: typeof obs.toolName === "string" ? obs.toolName : "tool",
        detail: truncate(stringify(obs.args)),
      })
      return
    }
    case "tool": {
      emit({
        kind: "tool_end",
        tool: typeof obs.toolName === "string" ? obs.toolName : "tool",
        detail: truncate(stringify(obs.result)),
        ...(obs.isError === true ? { isError: true } : {}),
      })
      return
    }
    case "text_delta": {
      const delta = typeof obs.delta === "string" ? obs.delta : ""
      if (delta) emit({ kind: "assistant", text: delta })
      return
    }
    case "run_start":
    case "agent_start":
      emit({ kind: "lifecycle", text: obs.type })
      return
    default:
      return
  }
})
