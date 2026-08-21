"use client"

import { Button, Textarea } from "@cortex/ui"
import { ArrowUp, FileText, Loader2, Paperclip } from "lucide-react"
import { useRef, type ClipboardEvent, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import type { CoworkInputFile, CoworkSessionUsage } from "../types"
import { ContextMeter } from "./context-meter"

interface MessageComposerProps {
  /** Controlled draft - lifted so brief cards can prefill the composer. */
  value: string
  onChange: (value: string) => void
  onSend: (content: string) => void
  disabled?: boolean
  /** Live usage of the active session - rendered as the context chip. */
  usage?: CoworkSessionUsage | undefined
  /** Present when the session accepts input-file uploads (attach + paste). */
  onUploadFiles?: ((files: File[]) => void) | undefined
  isUploading?: boolean
  /** Files already staged in the session's input/ directory (chips row). */
  inputFiles?: CoworkInputFile[]
}

/**
 * Clipboard pastes of screenshots arrive as a generic "image.png" - stamp a
 * time suffix so consecutive pastes stay distinguishable in the sandbox.
 */
function withPasteName(file: File): File {
  if (file.name && file.name !== "image.png") return file
  const stamp = new Date().toISOString().slice(11, 19).replaceAll(":", "")
  const ext = file.type.split("/")[1] ?? "png"
  return new File([file], `wklejka-${stamp}.${ext}`, { type: file.type })
}

/** Codex-style prompt box: rounded card with attach, send and context chip inside. */
export function MessageComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  usage,
  onUploadFiles,
  isUploading = false,
  inputFiles = [],
}: MessageComposerProps) {
  const { t } = useTranslation("cortex-cowork")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    onChange("")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!onUploadFiles) return
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    onUploadFiles(files.map(withPasteName))
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-ring/60">
      {inputFiles.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-1.5 pb-1 pt-0.5">
          {inputFiles.map((file) => (
            <span
              key={file.filename}
              className="inline-flex max-w-56 items-center gap-1 rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              title={file.filename}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{file.filename}</span>
            </span>
          ))}
        </div>
      ) : null}
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={t("composer.placeholder")}
        disabled={disabled}
        rows={2}
        className="min-h-[44px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-3 px-1.5 pb-0.5 pt-1">
        <div className="flex items-center gap-1">
          {onUploadFiles ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  if (files.length > 0) onUploadFiles(files)
                  event.target.value = ""
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label={t("composer.attachAria")}
                title={t("composer.attachTitle")}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{t("composer.hint")}</span>
        </div>
        <div className="flex items-center gap-3">
          {usage ? <ContextMeter usage={usage} /> : null}
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label={t("composer.sendAria")}
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
