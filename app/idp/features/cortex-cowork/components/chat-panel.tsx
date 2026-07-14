"use client"

import { useCoworkStreamStore } from "@/lib/stores/cortex-cowork-stream-store"
import { LoadingState } from "@cortex/ui"
import { MessagesSquare } from "lucide-react"
import { useEffect, useRef } from "react"
import type { ChatMessage, CoworkSessionUsage } from "../types"
import { LiveAgentActivity } from "./agent-activity"
import { MessageBubble } from "./message-bubble"
import { MessageComposer } from "./message-composer"

interface ChatPanelProps {
  messages: ChatMessage[]
  isSending: boolean
  isLoadingSession: boolean
  onSend: (content: string) => void
  usage?: CoworkSessionUsage | undefined
  /** Shown in the empty-transcript hero. */
  projectName?: string | undefined
}

/** Centered Codex-style transcript column with the prompt box at the bottom. */
export function ChatPanel({
  messages,
  isSending,
  isLoadingSession,
  onSend,
  usage,
  projectName,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const liveSteps = useCoworkStreamStore((state) => state.steps)
  const liveText = useCoworkStreamStore((state) => state.liveText)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, liveSteps.length, liveText])

  const empty = !isLoadingSession && messages.length === 0 && !isSending

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoadingSession ? (
          <LoadingState label="Startuję sesję sandboxa..." />
        ) : empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <MessagesSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {projectName ? `${projectName} - czym mam się zająć?` : "Czym mam się zająć?"}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Agent pracuje w sandboxie i oddaje pliki jako artefakty - poproś o raport, eksport
              albo analizę.
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending ? <LiveAgentActivity steps={liveSteps} liveText={liveText} /> : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pb-5 pt-2">
        <MessageComposer onSend={onSend} disabled={isLoadingSession || isSending} usage={usage} />
      </div>
    </div>
  )
}
