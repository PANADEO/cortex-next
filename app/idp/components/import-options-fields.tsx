"use client"

import type { PackagingSelectionMode } from "@cortex/types"
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@cortex/ui"
import { useState } from "react"

export const MAX_AI_CONTEXT = 4000
export const DEFAULT_PACKAGING_SELECTION_MODE: PackagingSelectionMode = "auto_by_bill_of_lading"

export interface ImportOptions {
  fast_processing: boolean
  atr_processing_enabled: boolean
  additional_ai_context_enabled: boolean
  additional_ai_context: string
  packaging_selection_mode: PackagingSelectionMode
}

export const emptyImportOptions: ImportOptions = {
  fast_processing: false,
  atr_processing_enabled: true,
  additional_ai_context_enabled: false,
  additional_ai_context: "",
  packaging_selection_mode: DEFAULT_PACKAGING_SELECTION_MODE,
}

export interface SerializedImportOptions {
  fast_processing: boolean
  atr_processing_enabled: boolean
  additional_ai_context_enabled: boolean
  additional_ai_context: string | null
  packaging_selection_mode: PackagingSelectionMode | null
}

export interface SerializeImportOptionsConfig {
  atrProcessingAvailable?: boolean
  additionalAiContextAvailable?: boolean
  packagingSelectionModeAvailable?: boolean
}

export function serializeImportOptions(
  state: ImportOptions,
  config: SerializeImportOptionsConfig = {},
): SerializedImportOptions {
  const trimmed = state.additional_ai_context.trim()
  const atrProcessingAvailable = config.atrProcessingAvailable ?? false
  const additionalAiContextAvailable = config.additionalAiContextAvailable ?? false
  const packagingSelectionModeAvailable = config.packagingSelectionModeAvailable ?? false
  const hasContext =
    additionalAiContextAvailable && state.additional_ai_context_enabled && trimmed !== ""
  return {
    fast_processing: state.fast_processing,
    atr_processing_enabled: atrProcessingAvailable && state.atr_processing_enabled,
    additional_ai_context_enabled: hasContext,
    additional_ai_context: hasContext ? trimmed : null,
    packaging_selection_mode: packagingSelectionModeAvailable
      ? state.packaging_selection_mode
      : null,
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
  showPackagingSelectionMode?: boolean
}

export function ImportOptionsFields({
  idPrefix,
  state,
  onChange,
  showAtrProcessing = false,
  showAdditionalAiContext = false,
  showPackagingSelectionMode = false,
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

      {showPackagingSelectionMode ? (
        <div className="space-y-2 rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-xs font-medium">Packaging mode</p>
            <p className="text-[10px] text-muted-foreground">
              Select package or pallet counts for SAD/Huzar extraction.
            </p>
          </div>
          <Select
            value={state.packaging_selection_mode}
            onValueChange={(value) =>
              onChange({ packaging_selection_mode: value as PackagingSelectionMode })
            }
          >
            <SelectTrigger id={`${idPrefix}-packaging-mode`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_by_bill_of_lading">Auto by B/L</SelectItem>
              <SelectItem value="force_packages">Packages</SelectItem>
              <SelectItem value="force_pallets">Pallets</SelectItem>
            </SelectContent>
          </Select>
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
