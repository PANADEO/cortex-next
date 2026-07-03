"use client"

import { cn } from "@cortex/utils"
import { Bot, User } from "lucide-react"
import type { ChatMessage } from "../types"
import { AgentActivityTrail } from "./agent-activity"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-cortex/15 text-cortex",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {!isUser && message.activity && message.activity.length > 0 ? (
          <AgentActivityTrail steps={message.activity} />
        ) : null}
      </div>
    </div>
  )
}
