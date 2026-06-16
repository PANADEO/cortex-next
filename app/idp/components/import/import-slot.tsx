"use client"

import { ImportOptionsFields, type ImportOptions } from "@/components/import-options-fields"
import { Badge, Button, Input, Label } from "@cortex/ui"
import { cn, formatFileSizeBytes } from "@cortex/utils"
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileArchive,
  FilePlus2,
  Files,
  FolderPlus,
  Loader2,
  Mail,
  Upload,
  X,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState, type DragEvent } from "react"
import {
  detectIntakeKind,
  filesFromDataTransfer,
  isEmailFile,
  isZipFile,
  type IntakeKind,
} from "./file-intake"

const ACCEPTED_IMPORT_FILES = ".zip,.eml,.msg,.pdf,.docx,.xlsx,.png,.jpg,.jpeg"

export type ImportSlotStatus = "pending" | "ready" | "uploading" | "done" | "error"

export interface ImportSlotValue {
  id: string
  files: File[]
  packageName: string
  options: ImportOptions
  status: ImportSlotStatus
  errorMessage?: string | undefined
  packageId?: string | undefined
}

interface ImportSlotProps {
  slot: ImportSlotValue
  canRemove: boolean
  onFilesChange: (files: File[]) => void
  onPackageNameChange: (packageName: string) => void
  onOptionsChange: (patch: Partial<ImportOptions>) => void
  onRemove: () => void
  onSubmit: () => void
  showAtrProcessing?: boolean
  showAdditionalAiContext?: boolean
}

const STATUS_META: Record<
  ImportSlotStatus,
  { label: string; tone: string; icon: typeof Upload; animate?: boolean }
> = {
  pending: {
    label: "Waiting for files",
    tone: "bg-muted text-muted-foreground",
    icon: Upload,
  },
  ready: {
    label: "Ready to import",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  uploading: {
    label: "Uploading…",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    icon: Loader2,
    animate: true,
  },
  done: {
    label: "Imported",
    tone: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  error: {
    label: "Failed",
    tone: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    icon: AlertCircle,
  },
}

export function ImportSlot({
  slot,
  canRemove,
  onFilesChange,
  onPackageNameChange,
  onOptionsChange,
  onRemove,
  onSubmit,
  showAtrProcessing = false,
  showAdditionalAiContext = false,
}: ImportSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
  }, [])

  const isEmpty = slot.files.length === 0
  const isBusy = slot.status === "uploading"
  const statusMeta = STATUS_META[slot.status]
  const StatusIcon = statusMeta.icon
  const kind: IntakeKind | null = isEmpty ? null : detectIntakeKind(slot.files)
  const isEmailContainer = kind === "email"

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    onFilesChange([...slot.files, ...incoming])
  }

  const handleInput = (list: FileList | null) => {
    if (!list) return
    addFiles(Array.from(list))
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (isBusy) return
    const files = await filesFromDataTransfer(e.dataTransfer)
    addFiles(files)
  }

  const removeFile = (idx: number) => {
    onFilesChange(slot.files.filter((_, i) => i !== idx))
  }

  const isActionable = slot.status === "ready" || slot.status === "error"

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        slot.status === "done" && "border-emerald-500/40 bg-emerald-500/5",
        slot.status === "error" && "border-red-500/40",
        slot.status === "uploading" && "border-sky-500/40",
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        {slot.status === "done" && slot.packageId ? (
          <Link
            href={`/idp/packages/${slot.packageId}`}
            aria-label="Open package details"
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-emerald-500/30",
              statusMeta.tone,
            )}
          >
            <StatusIcon className={cn("h-3 w-3", statusMeta.animate && "animate-spin")} />
            {statusMeta.label}
          </Link>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              statusMeta.tone,
            )}
          >
            <StatusIcon className={cn("h-3 w-3", statusMeta.animate && "animate-spin")} />
            {statusMeta.label}
          </span>
        )}

        {kind ? (
          <Badge variant="outline" className="gap-1 text-[10px]">
            {kind === "zip" ? (
              <FileArchive className="h-3 w-3" />
            ) : kind === "email" ? (
              <Mail className="h-3 w-3" />
            ) : (
              <Files className="h-3 w-3" />
            )}
            {kind === "zip"
              ? "ZIP bundle"
              : kind === "email"
                ? "Email container"
                : `${slot.files.length} files → one package`}
          </Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {canRemove || !isEmpty ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isBusy}
              onClick={onRemove}
              aria-label="Remove slot"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {isEmpty ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "mx-4 my-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors",
            "hover:bg-muted/40",
            dragging && "border-primary bg-accent",
          )}
          role="button"
          tabIndex={0}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Drop a ZIP, EML, MSG, files or folders here</p>
          <p className="text-[11px] text-muted-foreground">
            Single email files are unpacked by the backend; other files are grouped as one package.
          </p>
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
              Choose files
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              Choose folder
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMPORT_FILES}
            className="hidden"
            onChange={(e) => handleInput(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleInput(e.target.files)}
          />
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4 pt-3">
          {slot.status !== "done" ? (
            <div className="space-y-1.5">
              <Label
                htmlFor={`package-name-${slot.id}`}
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Package name
              </Label>
              <Input
                id={`package-name-${slot.id}`}
                value={slot.packageName}
                onChange={(e) => onPackageNameChange(e.target.value)}
                maxLength={255}
                placeholder="Optional display name"
                className="h-8 text-xs"
                disabled={isBusy}
              />
            </div>
          ) : null}

          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-1.5">
            {slot.files.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs"
              >
                {isZipFile(file) ? (
                  <FileArchive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : isEmailFile(file) ? (
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Files className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSizeBytes(file.size)}
                </span>
                {!isBusy && slot.status !== "done" ? (
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {slot.status === "error" && slot.errorMessage ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {slot.errorMessage}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            {slot.status === "done" ? (
              <div className="ml-auto">
                <Button asChild size="sm" className="h-8">
                  <Link href={`/idp/packages/${slot.packageId}`} aria-label="Open package details">
                    Open package
                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {!isEmailContainer ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                  >
                    <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                    Add more
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowOptions((v) => !v)}
                  disabled={isBusy}
                >
                  {showOptions ? "Hide options" : "Advanced options"}
                </Button>
                <div className="ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={onSubmit}
                    disabled={!isActionable}
                  >
                    {slot.status === "uploading" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {slot.status === "error" ? "Retry" : "Import"}
                  </Button>
                </div>
              </>
            )}
          </div>

          {showOptions ? (
            <ImportOptionsFields
              idPrefix={`slot-${slot.id}`}
              state={slot.options}
              onChange={onOptionsChange}
              showAtrProcessing={showAtrProcessing}
              showAdditionalAiContext={showAdditionalAiContext}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMPORT_FILES}
            className="hidden"
            onChange={(e) => handleInput(e.target.files)}
          />
        </div>
      )}
    </div>
  )
}
