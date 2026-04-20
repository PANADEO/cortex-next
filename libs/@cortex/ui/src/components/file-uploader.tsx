"use client"

import { cn } from "@cortex/utils"
import { FileArchive, Upload, X } from "lucide-react"
import { useCallback, useRef, useState, type DragEvent } from "react"
import { Button } from "./ui/button"

interface FileUploaderProps {
  accept?: string
  multiple?: boolean
  onFilesSelected: (files: File[]) => void
  description?: string
  className?: string
}

export function FileUploader({
  accept,
  multiple = false,
  onFilesSelected,
  description,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<File[]>([])

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return
      const files = multiple ? Array.from(list) : [list[0]!]
      setSelected(files)
      onFilesSelected(files)
    },
    [multiple, onFilesSelected],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handle(e.dataTransfer.files)
  }

  const remove = (idx: number) => {
    const next = selected.filter((_, i) => i !== idx)
    setSelected(next)
    onFilesSelected(next)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/50",
          dragging && "border-primary bg-accent",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
          <Upload className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">
          {multiple ? "Drop files here or click to browse" : "Drop a ZIP or click to browse"}
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
      {selected.length > 0 ? (
        <ul className="space-y-1.5">
          {selected.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(idx)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
