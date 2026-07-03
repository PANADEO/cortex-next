"use client"

import { Button, Textarea } from "@cortex/ui"
import { Loader2, Send } from "lucide-react"
import { useState, type KeyboardEvent } from "react"

interface MessageComposerProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
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
    <div className="flex items-end gap-2 border-t border-border bg-background p-3">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask for an excel report, a csv export, or anything else..."
        disabled={disabled}
        rows={2}
        className="resize-none"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        size="icon"
        aria-label="Send message"
      >
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  )
}
