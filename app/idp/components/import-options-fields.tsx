"use client"

import { Label, Switch, Textarea } from "@cortex/ui"
import { useState } from "react"

export const MAX_AI_CONTEXT = 4000

export interface ImportOptions {
  fast_processing: boolean
  atr_processing_enabled: boolean
  additional_ai_context_enabled: boolean
  additional_ai_context: string
}

export const emptyImportOptions: ImportOptions = {
  fast_processing: false,
  atr_processing_enabled: true,
  additional_ai_context_enabled: false,
  additional_ai_context: "",
}

export interface SerializedImportOptions {
  fast_processing: boolean
  atr_processing_enabled: boolean
  additional_ai_context_enabled: boolean
  additional_ai_context: string | null
}

export interface SerializeImportOptionsConfig {
  atrProcessingAvailable?: boolean
  additionalAiContextAvailable?: boolean
}

export function serializeImportOptions(
  state: ImportOptions,
  config: SerializeImportOptionsConfig = {},
): SerializedImportOptions {
  const trimmed = state.additional_ai_context.trim()
  const atrProcessingAvailable = config.atrProcessingAvailable ?? false
  const additionalAiContextAvailable = config.additionalAiContextAvailable ?? false
  const hasContext =
    additionalAiContextAvailable && state.additional_ai_context_enabled && trimmed !== ""
  return {
    fast_processing: state.fast_processing,
    atr_processing_enabled: atrProcessingAvailable && state.atr_processing_enabled,
    additional_ai_context_enabled: hasContext,
    additional_ai_context: hasContext ? trimmed : null,
  }
}

export function useImportOptions(initial: ImportOptions = emptyImportOptions) {
  const [state, setState] = useState<ImportOptions>(initial)
  const update = (patch: Partial<ImportOptions>) => setState((prev) => ({ ...prev, ...patch }))
  const reset = () => setState(initial)
  const serialize = (config?: SerializeImportOptionsConfig) => serializeImportOptions(state, config)
  return { state, update, reset, serialize }
}

interface ImportOptionsFieldsProps {
  idPrefix: string
  state: ImportOptions
  onChange: (patch: Partial<ImportOptions>) => void
  showAtrProcessing?: boolean
  showAdditionalAiContext?: boolean
}

export function ImportOptionsFields({
  idPrefix,
  state,
  onChange,
  showAtrProcessing = false,
  showAdditionalAiContext = false,
}: ImportOptionsFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <p className="text-xs font-medium">Fast processing</p>
          <p className="text-[10px] text-muted-foreground">Cheaper Gemini model; lower accuracy.</p>
        </div>
        <Switch
          checked={state.fast_processing}
          onCheckedChange={(v) => onChange({ fast_processing: v })}
        />
      </div>

      {showAtrProcessing ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-xs font-medium">Process A.TR documents</p>
            <p className="text-[10px] text-muted-foreground">
              Extract and assign A.TR data for this package.
            </p>
          </div>
          <Switch
            checked={state.atr_processing_enabled}
            onCheckedChange={(v) => onChange({ atr_processing_enabled: v })}
          />
        </div>
      ) : null}

      {showAdditionalAiContext ? (
        <div className="space-y-2 rounded-md border border-border px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Additional AI context</p>
              <p className="text-[10px] text-muted-foreground">
                Extra prompt appended to extraction. Max {MAX_AI_CONTEXT} chars.
              </p>
            </div>
            <Switch
              checked={state.additional_ai_context_enabled}
              onCheckedChange={(v) => onChange({ additional_ai_context_enabled: v })}
            />
          </div>
          {state.additional_ai_context_enabled ? (
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-ai-context`} className="sr-only">
                Additional AI context
              </Label>
              <Textarea
                id={`${idPrefix}-ai-context`}
                value={state.additional_ai_context}
                onChange={(e) => onChange({ additional_ai_context: e.target.value })}
                maxLength={MAX_AI_CONTEXT}
                rows={3}
                placeholder="e.g. 'This batch is from DHL — invoice totals in EUR.'"
                className="resize-none"
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {state.additional_ai_context.length} / {MAX_AI_CONTEXT}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
