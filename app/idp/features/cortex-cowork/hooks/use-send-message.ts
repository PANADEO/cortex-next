"use client"

import { useCoworkStreamStore } from "@/lib/stores/cortex-cowork-stream-store"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { AgentActivityStep, ChatMessage, CoworkSession, SendMessageResponse } from "../types"

function pendingUserMessage(content: string): ChatMessage {
  return {
    id: `pending-${Date.now()}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  }
}

interface SseEvent {
  event: string
  data: string
}

/**
 * Minimal SSE frame parser over accumulated text. Returns complete events and
 * the unconsumed remainder (a partial frame still being received).
 */
function parseSseChunks(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  const frames = buffer.split("\n\n")
  const rest = frames.pop() ?? ""
  for (const frame of frames) {
    let event = "message"
    const dataLines: string[] = []
    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim()
      else if (line.startsWith("data: ")) dataLines.push(line.slice(6))
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join("\n") })
  }
  return { events, rest }
}

async function streamTurn(
  sessionId: string,
  content: string,
  onStep: (step: AgentActivityStep) => void,
): Promise<SendMessageResponse> {
  const response = await fetch(coworkApi.streamMessagePath(sessionId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!response.ok || !response.body) {
    throw new Error(`stream request failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: SendMessageResponse | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = parseSseChunks(buffer)
    buffer = rest
    for (const sse of events) {
      if (sse.event === "activity") {
        try {
          onStep(JSON.parse(sse.data) as AgentActivityStep)
        } catch {
          // malformed frame - skip
        }
      } else if (sse.event === "done") {
        result = JSON.parse(sse.data) as SendMessageResponse
      } else if (sse.event === "error") {
        const payload = JSON.parse(sse.data) as { message?: string }
        throw new Error(payload.message ?? "agent turn failed")
      }
    }
  }

  if (!result) throw new Error("stream ended without a result")
  return result
}

/**
 * Sends a chat message over the SSE streaming endpoint, feeding live agent
 * activity into the cowork stream store; falls back to the plain POST when
 * streaming is unavailable. Exposes a `useMutation`-compatible surface
 * (`mutate`, `isPending`) so callers stay unchanged.
 */
export function useSendCoworkMessage(sessionId: string) {
  const client = useQueryClient()
  const [isPending, setIsPending] = useState(false)

  const mutate = useCallback(
    (content: string) => {
      if (!sessionId || isPending) return
      const queryKey = coworkQueryKeys.session(sessionId)
      const stream = useCoworkStreamStore.getState()
      setIsPending(true)
      stream.begin()

      const previous = client.getQueryData<CoworkSession>(queryKey)
      client.setQueryData<CoworkSession | undefined>(queryKey, (session) =>
        session
          ? { ...session, messages: [...session.messages, pendingUserMessage(content)] }
          : session,
      )

      const applyResult = (result: SendMessageResponse) => {
        client.setQueryData<CoworkSession | undefined>(queryKey, (session) =>
          session
            ? {
                ...session,
                messages: [...session.messages, result.message],
                artifacts: [...session.artifacts, ...result.artifacts],
                usage: result.usage,
              }
            : session,
        )
      }

      streamTurn(sessionId, content, (step) => useCoworkStreamStore.getState().pushStep(step))
        .then(applyResult)
        .catch((streamError: unknown) => {
          console.warn("[cortex-cowork] stream failed, falling back to plain POST:", streamError)
          return coworkApi.sendMessage(sessionId, content).then(applyResult)
        })
        .catch(() => {
          if (previous) client.setQueryData(queryKey, previous)
        })
        .finally(() => {
          useCoworkStreamStore.getState().end()
          setIsPending(false)
          void client.invalidateQueries({ queryKey: coworkQueryKeys.artifacts(sessionId) })
        })
    },
    [client, isPending, sessionId],
  )

  return { mutate, isPending }
}
