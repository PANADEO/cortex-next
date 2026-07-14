"use client"

import { Button, Textarea } from "@cortex/ui"
import { ArrowUp, Loader2 } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import type { CoworkSessionUsage } from "../types"
import { ContextMeter } from "./context-meter"

interface MessageComposerProps {
  onSend: (content: string) => void
  disabled?: boolean
  /** Live usage of the active session - rendered as the context chip. */
  usage?: CoworkSessionUsage | undefined
}

/** Codex-style prompt box: rounded card with the send button and context chip inside. */
export function MessageComposer({ onSend, disabled = false, usage }: MessageComposerProps) {
  const [value, setValue] = useState("")

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring/60">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Poproś o raport, eksport albo kolejny krok..."
        disabled={disabled}
        rows={2}
        className="min-h-[44px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-3 px-1.5 pb-0.5 pt-1">
        <span className="text-[11px] text-muted-foreground">
          Enter wysyła · Shift+Enter nowa linia
        </span>
        <div className="flex items-center gap-3">
          {usage ? <ContextMeter usage={usage} /> : null}
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="Wyślij wiadomość"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
