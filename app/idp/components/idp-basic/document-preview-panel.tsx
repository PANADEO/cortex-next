"use client"

import { IdpBasicDeleteDocumentButton } from "@/components/idp-basic/delete-actions"
import { useIdpBasicDocumentContent } from "@/lib/idp-basic/hooks"
import type { IdpBasicDocument } from "@/lib/idp-basic/types"
import { Badge, Card, CardContent, LoadingState } from "@cortex/ui"
import { canPreviewInline, cn, formatFileSizeBytes, getFileTypeIcon } from "@cortex/utils"
import type { TFunction } from "i18next"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { formatIdpBasicDisplayText, getIdpBasicDocumentTypeLabel } from "./status"

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  {
    ssr: false,
    loading: () => <DocumentViewerFallback />,
  },
)

/** Osobny komponent, bo `loading` z `next/dynamic` renderuje się bez dostępu
 *  do `t` z komponentu nadrzędnego — hook musi mieć własne wywołanie. */
function DocumentViewerFallback() {
  const { t } = useTranslation("idp-basic")
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("preview.loadingViewer")}
    </div>
  )
}

interface DocumentPreviewPanelProps {
  packageId: string
  documents: IdpBasicDocument[]
  deleteDisabled?: boolean
  sidebarSlot?: ReactNode
}

export function DocumentPreviewPanel({
  packageId,
  documents,
  deleteDisabled,
  sidebarSlot,
}: DocumentPreviewPanelProps) {
  const { t } = useTranslation("idp-basic")
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "")

  useEffect(() => {
    if (!documents.some((doc) => doc.id === activeId)) {
      setActiveId(documents[0]?.id ?? "")
    }
  }, [activeId, documents])

  const active = useMemo(
    () => documents.find((doc) => doc.id === activeId) ?? documents[0] ?? null,
    [activeId, documents],
  )
  const previewable = active
    ? canPreviewInline(active.file_name, active.media_type, active.preview_kind)
    : false
  const content = useIdpBasicDocumentContent(
    packageId,
    active?.id ?? "",
    Boolean(active && previewable),
  )

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t("preview.noDocuments")}
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      data-idp-basic-preview-panel
      className="grid min-h-0 flex-1 gap-3 overflow-visible lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden"
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-visible lg:overflow-hidden">
        {sidebarSlot ? <div className="shrink-0">{sidebarSlot}</div> : null}
        <Card className="min-h-0 lg:flex-1 lg:overflow-hidden">
          <CardContent className="flex min-h-0 flex-col gap-3 p-3 lg:h-full lg:overflow-y-auto">
            {documents.map((document) => {
              const { Icon, toneClass } = getFileTypeIcon(document.file_name, document.media_type)
              const isActive = document.id === active?.id
              return (
                <div
                  key={document.id}
                  className={cn(
                    "relative rounded-md border transition-colors",
                    isActive
                      ? "border-cortex bg-cortex/5"
                      : "border-border hover:border-cortex/60 hover:bg-muted/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(document.id)}
                    className="w-full p-3 pr-11 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{document.file_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSizeBytes(document.size_bytes)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {getIdpBasicDocumentTypeLabel(t, document.document_type)}
                      </Badge>
                      {document.confidence != null ? (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(document.confidence * 100)}%
                        </span>
                      ) : null}
                    </div>
                    {document.summary ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {document.summary}
                      </p>
                    ) : null}
                    <DocumentAiFields t={t} document={document} />
                  </button>
                  <IdpBasicDeleteDocumentButton
                    packageId={packageId}
                    documentId={document.id}
                    fileName={document.file_name}
                    compact
                    disabled={deleteDisabled}
                    className="absolute right-2 top-2 h-7 w-7"
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="min-h-[420px] overflow-hidden lg:min-h-0">
        {!active ? null : !previewable ? (
          <Card className="h-full">
            <CardContent className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium">{t("preview.noInlinePreview")}</p>
              <p className="max-w-md text-xs text-muted-foreground">
                {t("preview.noInlinePreviewHint")}
              </p>
            </CardContent>
          </Card>
        ) : content.isLoading ? (
          <LoadingState label={t("preview.loadingFile", { fileName: active.file_name })} />
        ) : content.error || !content.data ? (
          <Card className="h-full">
            <CardContent className="flex h-full min-h-0 items-center justify-center p-8 text-sm text-destructive">
              {t("preview.loadFailed")}
            </CardContent>
          </Card>
        ) : (
          <DocumentViewer
            source={content.data}
            fileName={active.file_name}
            mediaType={active.media_type}
            className="min-h-[420px] lg:h-full lg:min-h-0"
          />
        )}
      </div>
    </div>
  )
}

function DocumentAiFields({
  t,
  document,
}: {
  t: TFunction<"idp-basic">
  document: IdpBasicDocument
}) {
  const fields = [
    [t("fields.reference"), document.document_reference_number],
    [t("fields.date"), document.document_date],
    [t("fields.issuerOrCarrier"), document.issuer_or_carrier],
    [t("fields.invoiceNumber"), document.invoice_number],
    [t("fields.cmrNotes"), document.cmr_notes],
    ...document.extracted_data.map(
      (field) => [formatAiFieldLabel(t, field.name), field.value] as const,
    ),
  ].filter(([, value]) => Boolean(value))

  if (fields.length === 0 && document.ai_alerts.length === 0) return null

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {fields.length > 0 ? (
        <dl className="space-y-1 text-xs">
          {fields.slice(0, 5).map(([label, value]) => (
            <div
              key={`${label}-${value}`}
              className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(108px,40%)_minmax(0,1fr)]"
            >
              <dt className="min-w-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {document.ai_alerts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {document.ai_alerts.map((alert) => (
            <Badge key={alert} variant="outline" className="border-warning/40 text-warning">
              {formatIdpBasicDisplayText(t, alert)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Nazwy pól przysyłane przez AI bywają po polsku albo po niemiecku — to DANE
 * z drutu, nie etykiety, więc zostają po lewej stronie jako klucz dopasowania.
 * Po prawej stoi KLUCZ tłumaczenia, dzięki czemu trzeci język nie wymaga
 * dotknięcia tego pliku. Nazwa, której tu nie ma, idzie na ekran tak, jak
 * przyszła.
 */
const AI_FIELD_LABEL_KEYS: Record<string, string> = {
  "beleg-nr.": "fields.documentNumber",
  "beleg-nr": "fields.documentNumber",
  "nr faktury": "fields.invoiceNumber",
  "numer faktury": "fields.invoiceNumber",
  data: "fields.date",
  nadawca: "fields.sender",
  przewoźnik: "fields.carrier",
  przewoznik: "fields.carrier",
}

function formatAiFieldLabel(t: TFunction<"idp-basic">, label: string): string {
  const key = AI_FIELD_LABEL_KEYS[label.trim().toLowerCase()]
  return key ? t(key) : label
}
