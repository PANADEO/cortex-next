"use client"

import { useCoworkStreamStore } from "@/lib/stores/cortex-cowork-stream-store"
import type { CoworkProjectBrief } from "@cortex/types"
import { LoadingState } from "@cortex/ui"
import { FileUp, MessagesSquare, Sparkles } from "lucide-react"
import { useEffect, useRef, useState, type DragEvent } from "react"
import type { ChatMessage, CoworkInputFile, CoworkSessionUsage } from "../types"
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
  /** Admin-defined starter briefs, rendered as cards in the empty hero. */
  briefs?: CoworkProjectBrief[]
  /** Present when the session accepts input-file uploads (drop/paste/attach). */
  onUploadFiles?: ((files: File[]) => void) | undefined
  isUploading?: boolean
  inputFiles?: CoworkInputFile[]
}

/** Centered Codex-style transcript column with the prompt box at the bottom. */
export function ChatPanel({
  messages,
  isSending,
  isLoadingSession,
  onSend,
  usage,
  projectName,
  briefs = [],
  onUploadFiles,
  isUploading = false,
  inputFiles = [],
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  // Lifted composer draft so brief cards can prefill it (click = insert, not send).
  const [draft, setDraft] = useState("")
  const liveSteps = useCoworkStreamStore((state) => state.steps)
  const liveText = useCoworkStreamStore((state) => state.liveText)
  // Depth counter instead of a boolean: dragenter/dragleave fire for every
  // child element crossed, so a plain flag flickers while dragging.
  const dragDepth = useRef(0)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, liveSteps.length, liveText])

  const empty = !isLoadingSession && messages.length === 0 && !isSending

  function hasFiles(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files")
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!onUploadFiles || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!onUploadFiles || !hasFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onUploadFiles || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onUploadFiles(files)
  }

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (onUploadFiles && hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive ? (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-ring/70 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="h-5 w-5" />
            Upuść pliki - trafią do sandboxa tej sesji
          </div>
        </div>
      ) : null}
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
            {briefs.length > 0 ? (
              <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
                {briefs.map((brief) => (
                  <button
                    key={brief.id}
                    type="button"
                    onClick={() => setDraft(brief.prompt)}
                    className="group rounded-xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-ring/60 hover:bg-card"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-cortex opacity-60 transition-opacity group-hover:opacity-100" />
                      {brief.title}
                    </span>
                    {brief.hint ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {brief.hint}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
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
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={onSend}
          disabled={isLoadingSession || isSending}
          usage={usage}
          onUploadFiles={onUploadFiles}
          isUploading={isUploading}
          inputFiles={inputFiles}
        />
      </div>
    </div>
  )
}
