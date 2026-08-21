"use client"

import { EXPORT_FIELD_GROUPS, EXPORT_FORMATS, type ExportFormat } from "@/lib/export/fields"
import type { ExportBuilderState } from "@/lib/export/use-export-builder"
import { Checkbox, Input, Label, ScrollArea, Switch } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import {
  Download,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Layers,
} from "lucide-react"
import { useTranslation } from "react-i18next"

const FORMAT_ICON: Record<ExportFormat, LucideIcon> = {
  csv: FileText,
  xml: FileCode,
  json: FileJson,
  xlsx: FileSpreadsheet,
}

interface ExportConfigProps {
  state: ExportBuilderState
}

export function ExportConfig({ state }: ExportConfigProps) {
  const { t } = useTranslation("idp")
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{t("export.config.title")}</h3>
        <p className="text-[11px] text-muted-foreground">{t("export.config.subtitle")}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <FormatSection state={state} />
          <FieldsSection state={state} />
          <PackagingSection state={state} />
          <DestinationSection state={state} />
        </div>
      </ScrollArea>
    </div>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FormatSection({ state }: { state: ExportBuilderState }) {
  const { t } = useTranslation("idp")
  return (
    <section className="space-y-2">
      <SectionHeading title={t("export.config.outputFormat")} />
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = FORMAT_ICON[fmt.id]
          const active = state.format === fmt.id
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => state.setFormat(fmt.id)}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <Icon
                className={cn("mt-0.5 h-4 w-4", active ? "text-primary" : "text-muted-foreground")}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{t(fmt.labelKey)}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {t(fmt.descriptionKey)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function FieldsSection({ state }: { state: ExportBuilderState }) {
  const { t } = useTranslation("idp")
  const totalSelected = state.selectedFields.size
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <SectionHeading
          title={t("export.config.columns")}
          hint={t("export.config.columnsHint", { count: totalSelected })}
        />
        <button
          type="button"
          onClick={state.resetFields}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {t("export.config.resetDefaults")}
        </button>
      </div>

      <div className="space-y-3">
        {EXPORT_FIELD_GROUPS.map((group) => {
          const ids = group.fields.map((f) => f.id)
          const allOn = ids.every((id) => state.selectedFields.has(id))
          const anyOn = ids.some((id) => state.selectedFields.has(id))
          return (
            <div key={group.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allOn ? true : anyOn ? "indeterminate" : false}
                    onCheckedChange={(v) => state.setGroupFields(ids, v === true)}
                    aria-label={t("export.config.toggleGroup", { group: t(group.labelKey) })}
                  />
                  <span className="text-xs font-medium">{t(group.labelKey)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {ids.filter((id) => state.selectedFields.has(id)).length}/{ids.length}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-1 p-2">
                {group.fields.map((field) => {
                  const checked = state.selectedFields.has(field.id)
                  return (
                    <li key={field.id}>
                      <label
                        htmlFor={`field-${field.id}`}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-xs hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`field-${field.id}`}
                          checked={checked}
                          onCheckedChange={() => state.toggleField(field.id)}
                        />
                        <span className="truncate">{t(field.labelKey)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PackagingSection({ state }: { state: ExportBuilderState }) {
  const { t } = useTranslation("idp")
  return (
    <section className="space-y-2">
      <SectionHeading title={t("export.config.packaging")} />
      <div className="space-y-2 rounded-md border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div>
            <p className="text-xs font-medium">{t("export.config.includeSources")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("export.config.includeSourcesHint")}
            </p>
          </div>
          <Switch checked={state.includeSources} onCheckedChange={state.setIncludeSources} />
        </div>

        <div className="space-y-2 px-3 py-2">
          <p className="text-xs font-medium">{t("export.config.bundle")}</p>
          <div className="grid grid-cols-2 gap-2">
            <PackagingOption
              icon={Layers}
              label={t("export.config.individual")}
              hint={t("export.config.individualHint")}
              active={state.packaging === "individual"}
              onClick={() => state.setPackaging("individual")}
            />
            <PackagingOption
              icon={FolderTree}
              label={t("export.config.singleZip")}
              hint={t("export.config.singleZipHint")}
              active={state.packaging === "zip"}
              onClick={() => state.setPackaging("zip")}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function PackagingOption({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </button>
  )
}

function DestinationSection({ state }: { state: ExportBuilderState }) {
  const { t } = useTranslation("idp")
  return (
    <section className="space-y-2">
      <SectionHeading title={t("export.config.destination")} />
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <DestinationOption
            icon={Download}
            label={t("export.config.download")}
            hint={t("export.config.downloadHint")}
            active={state.destination === "download"}
            onClick={() => state.setDestination("download")}
          />
          <DestinationOption
            icon={FolderTree}
            label={t("export.config.networkFolder")}
            hint={t("export.config.networkFolderHint")}
            active={state.destination === "network"}
            onClick={() => state.setDestination("network")}
          />
        </div>

        {state.destination === "network" ? (
          <div className="space-y-1">
            <Label htmlFor="network-path" className="text-[11px]">
              {t("export.config.uncPath")}
            </Label>
            <Input
              id="network-path"
              value={state.networkPath}
              onChange={(e) => state.setNetworkPath(e.target.value)}
              placeholder="\\fileserver\share\exports"
              className="h-8 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{t("export.config.uncPathHint")}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DestinationOption({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </button>
  )
}
