"use client"

import { toastApiError, useImportMultiplePackages, useImportPackage } from "@cortex/api"
import {
  Button,
  Card,
  CardContent,
  FileUploader,
  Label,
  PageHeader,
  Switch,
  Textarea,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const MAX_CONTEXT = 4000

interface AiContextState {
  enabled: boolean
  text: string
}

function useAiContext(): [
  AiContextState,
  (next: Partial<AiContextState>) => void,
  () => {
    additional_ai_context_enabled: boolean
    additional_ai_context: string | null
  },
] {
  const [state, setState] = useState<AiContextState>({ enabled: false, text: "" })
  const update = (next: Partial<AiContextState>) =>
    setState((prev) => ({ ...prev, ...next }))
  const serialize = () => ({
    additional_ai_context_enabled: state.enabled,
    additional_ai_context: state.enabled && state.text.trim() ? state.text.trim() : null,
  })
  return [state, update, serialize]
}

export default function ImportPage() {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [loose, setLoose] = useState<File[]>([])
  const [zipFast, setZipFast] = useState(false)
  const [looseFast, setLooseFast] = useState(false)
  const [zipCtx, setZipCtx, serializeZipCtx] = useAiContext()
  const [looseCtx, setLooseCtx, serializeLooseCtx] = useAiContext()

  const importOne = useImportPackage()
  const importMany = useImportMultiplePackages()

  const submitZip = async () => {
    if (!zipFile) return
    if (zipCtx.enabled && zipCtx.text.trim() === "") {
      toast.error("Additional AI context is enabled but empty")
      return
    }
    try {
      await importOne.mutateAsync({
        file: zipFile,
        fast_processing: zipFast,
        ...serializeZipCtx(),
      })
      toast.success(`Imported ${zipFile.name}`)
      setZipFile(null)
      setZipCtx({ enabled: false, text: "" })
    } catch (err) {
      toastApiError(err)
    }
  }

  const submitLoose = async () => {
    if (loose.length === 0) return
    if (looseCtx.enabled && looseCtx.text.trim() === "") {
      toast.error("Additional AI context is enabled but empty")
      return
    }
    try {
      await importMany.mutateAsync({
        files: loose,
        fast_processing: looseFast,
        ...serializeLooseCtx(),
      })
      toast.success(`Imported ${loose.length} file(s)`)
      setLoose([])
      setLooseCtx({ enabled: false, text: "" })
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <>
      <PageHeader
        title="Import"
        description="Upload a ZIP package or multiple loose files (they will be zipped in the browser)."
      />
      <div className="grid flex-1 gap-6 px-8 py-6 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-sm font-semibold">Import ZIP package</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Single ZIP file containing invoices and transport documents.
              </p>
            </div>
            <FileUploader
              accept=".zip,application/zip"
              value={zipFile ? [zipFile] : []}
              onChange={(files) => setZipFile(files[0] ?? null)}
              description="Max 100 MB"
            />
            <FastProcessingToggle checked={zipFast} onChange={setZipFast} />
            <AdditionalAiContextField
              idPrefix="zip"
              state={zipCtx}
              onChange={setZipCtx}
            />
            <Button
              onClick={submitZip}
              disabled={!zipFile || importOne.isPending}
              className="w-full"
            >
              {importOne.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Import ZIP
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-sm font-semibold">Import files</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF / DOCX / XLSX — zipped client-side before upload.
              </p>
            </div>
            <FileUploader
              multiple
              accept=".pdf,.docx,.xlsx"
              value={loose}
              onChange={setLoose}
              description="Select multiple files"
            />
            <FastProcessingToggle checked={looseFast} onChange={setLooseFast} />
            <AdditionalAiContextField
              idPrefix="loose"
              state={looseCtx}
              onChange={setLooseCtx}
            />
            <Button
              onClick={submitLoose}
              disabled={loose.length === 0 || importMany.isPending}
              className="w-full"
            >
              {importMany.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Import files
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function FastProcessingToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div>
        <p className="text-xs font-medium">Fast processing</p>
        <p className="text-[10px] text-muted-foreground">
          Cheaper Gemini model; lower accuracy.
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

interface AdditionalAiContextFieldProps {
  idPrefix: string
  state: AiContextState
  onChange: (next: Partial<AiContextState>) => void
}

function AdditionalAiContextField({
  idPrefix,
  state,
  onChange,
}: AdditionalAiContextFieldProps) {
  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium">Additional AI context</p>
          <p className="text-[10px] text-muted-foreground">
            Extra prompt appended to extraction. Max {MAX_CONTEXT} chars.
          </p>
        </div>
        <Switch
          checked={state.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </div>
      {state.enabled ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-ai-context`} className="sr-only">
            Additional AI context
          </Label>
          <Textarea
            id={`${idPrefix}-ai-context`}
            value={state.text}
            onChange={(e) => onChange({ text: e.target.value })}
            maxLength={MAX_CONTEXT}
            rows={3}
            placeholder="e.g. 'This batch is from DHL — invoice totals in EUR.'"
            className="resize-none"
          />
          <p className="text-right text-[10px] text-muted-foreground">
            {state.text.length} / {MAX_CONTEXT}
          </p>
        </div>
      ) : null}
    </div>
  )
}
