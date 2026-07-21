"use client"

import { Badge } from "@cortex/ui"
import { TriangleAlert } from "lucide-react"
import { memo } from "react"
import type { ChatMessage } from "../types"
import { AgentActivityTrail } from "./agent-activity"
import { Markdown } from "./markdown"

interface MessageBubbleProps {
  message: ChatMessage
}

// Codex-style transcript: user prompts are compact right-aligned bubbles,
// assistant replies render as plain document text across the column.
// Memoized: during a streaming turn the transcript re-renders on every delta,
// and message objects are reference-stable, so this skips re-parsing every
// prior assistant message's Markdown on each tick.
export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm leading-7">
      {message.degraded ? (
        <Badge
          variant="outline"
          className="mb-1.5 gap-1 border-amber-400 text-amber-700 dark:text-amber-300"
        >
          <TriangleAlert className="h-3 w-3" />
          Tryb awaryjny - agent niedostępny
        </Badge>
      ) : null}
      <Markdown content={message.content} />
      {message.activity && message.activity.length > 0 ? (
        <AgentActivityTrail steps={message.activity} />
      ) : null}
    </div>
  )
})
