"use client"

import { INVOICE } from "@/features/store-pit/dataset"
import { count, eur } from "@/features/store-pit/helpers"
import { Badge, Card, CardContent, PageHeader } from "@cortex/ui"
import type { LucideIcon } from "lucide-react"
import { FileSpreadsheet, FileText } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface FileEntry {
  icon: LucideIcon
  name: string
  role: string
  stats: Array<{ label: string; value: string }>
}

export default function SourceFilesPage() {
  const { t } = useTranslation("store-pit")

  const files: FileEntry[] = useMemo(
    () => [
      {
        icon: FileSpreadsheet,
        name: "276.2300.2026.06.h.a.aa.3230613421.j.c.2760363466.910104622.de.24944.3.xx.a.csv",
        role: t("sourceFiles.roles.csv"),
        stats: [
          { label: t("sourceFiles.stats.rows"), value: count(INVOICE.csvRows) },
          { label: t("sourceFiles.stats.type"), value: t("sourceFiles.stats.typeCsv") },
          { label: t("sourceFiles.stats.encoding"), value: "UTF-8" },
        ],
      },
      {
        icon: FileText,
        name: "276.2300.2026.06.h.a.re.3230613421.j.c.2760363466.910104622.de.24944.3.xx.a.pdf",
        role: t("sourceFiles.roles.pdf"),
        stats: [
          { label: t("sourceFiles.stats.pages"), value: "3" },
          { label: t("fields.netTotal"), value: eur(INVOICE.pdfNetTotal) },
          { label: t("fields.grossTotal"), value: eur(INVOICE.pdfGrossTotal) },
        ],
      },
    ],
    [t],
  )

  const meta: Array<{ label: string; value: string }> = useMemo(
    () => [
      { label: t("sourceFiles.meta.carrier"), value: INVOICE.carrier },
      { label: t("sourceFiles.meta.glsInvoiceNo"), value: INVOICE.glsInvoiceNo },
      { label: t("sourceFiles.meta.spInvoiceNo"), value: INVOICE.spInvoiceNo },
      { label: t("sourceFiles.meta.customerNo"), value: INVOICE.customerNo },
      { label: t("sourceFiles.meta.invoiceDate"), value: INVOICE.invoiceDate },
      { label: t("sourceFiles.meta.period"), value: `${INVOICE.periodFrom} - ${INVOICE.periodTo}` },
      { label: t("sourceFiles.meta.week"), value: INVOICE.week },
      { label: t("sourceFiles.meta.currency"), value: INVOICE.currency },
      { label: t("fields.netTotal"), value: eur(INVOICE.pdfNetTotal) },
      { label: t("sourceFiles.meta.vat"), value: eur(INVOICE.pdfVat) },
      { label: t("fields.grossTotal"), value: eur(INVOICE.pdfGrossTotal) },
    ],
    [t],
  )

  return (
    <>
      <PageHeader
        title={t("sourceFiles.title")}
        description={t("sourceFiles.description")}
        actions={
          <Badge variant="outline" className="font-mono text-xs">
            {INVOICE.carrier} · {INVOICE.glsInvoiceNo}
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("sourceFiles.inputFilesTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {files.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.name} className="border-border/70">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {f.role}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-emerald-500/30 bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300"
                      >
                        {t("sourceFiles.parsed")}
                      </Badge>
                    </div>
                    <p className="break-all font-mono text-xs text-foreground">{f.name}</p>
                    <dl className="space-y-1.5">
                      {f.stats.map((s) => (
                        <div key={s.label} className="flex items-baseline justify-between gap-2">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {s.label}
                          </dt>
                          <dd className="text-xs font-medium tabular-nums">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("sourceFiles.metadataTitle")}</h2>
          <Card>
            <CardContent className="p-6">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {meta.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </dt>
                    <dd className="text-sm font-medium tabular-nums">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <p className="text-[11px] text-muted-foreground">
          {t("sourceFiles.footnote", {
            csvRows: count(INVOICE.csvRows),
            shipmentRows: count(INVOICE.shipmentRows),
          })}
        </p>
      </div>
    </>
  )
}
