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
  switch (observation.type) {
    case "thinking_start": {
      thinkingBuffers.set(thinkingKey(observation), "")
      emit({ kind: "thinking_start" })
      return
    }
    case "thinking_delta": {
      const key = thinkingKey(observation)
      thinkingBuffers.set(key, (thinkingBuffers.get(key) ?? "") + observation.delta)
      return
    }
    case "thinking_end": {
      const key = thinkingKey(observation)
      // `content` carries the whole block; the buffer is the incremental copy
      // and wins when we saw the deltas. Falling back to `content` also covers
      // subscribing mid-block, where no buffer exists.
      const text = thinkingBuffers.get(key) ?? observation.content
      thinkingBuffers.delete(key)
      if (text.trim()) emit({ kind: "thinking", text: truncate(text) })
      return
    }
    case "tool_start": {
      emit({
        kind: "tool_start",
        tool: observation.toolName,
        detail: truncate(stringify(observation.args)),
      })
      return
    }
    case "tool": {
      emit({
        kind: "tool_end",
        tool: observation.toolName,
        detail: truncate(stringify(observation.result)),
        ...(observation.isError ? { isError: true } : {}),
      })
      return
    }
    case "text_delta": {
      // The payload field is `text`, NOT `delta` (that one exists only on
      // thinking_delta). Reading `delta` here silently emitted nothing.
      if (observation.text) emit({ kind: "assistant", text: observation.text })
      return
    }
    case "run_start":
    case "agent_start":
      emit({ kind: "lifecycle", text: observation.type })
      return
    default:
      return
  }
})
