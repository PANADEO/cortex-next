"use client"

import { LoadingState } from "@cortex/ui"
import { useEffect, useRef } from "react"
import type { ChatMessage } from "../types"
import { MessageBubble } from "./message-bubble"
import { MessageComposer } from "./message-composer"

interface ChatPanelProps {
  messages: ChatMessage[]
  isSending: boolean
  isLoadingSession: boolean
  onSend: (content: string) => void
}

export function ChatPanel({ messages, isSending, isLoadingSession, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoadingSession ? (
          <LoadingState label="Starting sandbox session..." />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending ? <LoadingState label="Working in the sandbox..." /> : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <MessageComposer onSend={onSend} disabled={isLoadingSession || isSending} />
    </div>
  )
}
