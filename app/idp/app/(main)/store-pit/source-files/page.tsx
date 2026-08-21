"use client"

import { INVOICE } from "@/features/store-pit/dataset"
import { count, eur } from "@/features/store-pit/helpers"
import { Badge, Card, CardContent, PageHeader } from "@cortex/ui"
import type { LucideIcon } from "lucide-react"
import { FileSpreadsheet, FileText } from "lucide-react"

interface FileEntry {
  icon: LucideIcon
  name: string
  role: string
  stats: Array<{ label: string; value: string }>
}

const FILES: FileEntry[] = [
  {
    icon: FileSpreadsheet,
    name: "276.2300.2026.06.h.a.aa.3230613421.j.c.2760363466.910104622.de.24944.3.xx.a.csv",
    role: "Line-level CSV detail",
    stats: [
      { label: "Rows", value: count(INVOICE.csvRows) },
      { label: "Type", value: "GLS CSV export" },
      { label: "Encoding", value: "UTF-8" },
    ],
  },
  {
    icon: FileText,
    name: "276.2300.2026.06.h.a.re.3230613421.j.c.2760363466.910104622.de.24944.3.xx.a.pdf",
    role: "Invoice summary / rates",
    stats: [
      { label: "Pages", value: "3" },
      { label: "Net total", value: eur(INVOICE.pdfNetTotal) },
      { label: "Gross total", value: eur(INVOICE.pdfGrossTotal) },
    ],
  },
]

const META: Array<{ label: string; value: string }> = [
  { label: "Carrier", value: INVOICE.carrier },
  { label: "GLS invoice no", value: INVOICE.glsInvoiceNo },
  { label: "Store-Pit invoice no", value: INVOICE.spInvoiceNo },
  { label: "Customer no", value: INVOICE.customerNo },
  { label: "Invoice date", value: INVOICE.invoiceDate },
  { label: "Period", value: `${INVOICE.periodFrom} - ${INVOICE.periodTo}` },
  { label: "Week", value: INVOICE.week },
  { label: "Currency", value: INVOICE.currency },
  { label: "Net total", value: eur(INVOICE.pdfNetTotal) },
  { label: "VAT", value: eur(INVOICE.pdfVat) },
  { label: "Gross total", value: eur(INVOICE.pdfGrossTotal) },
]

export default function SourceFilesPage() {
  return (
    <>
      <PageHeader
        title="Source files"
        description="Input files registered for this GLS Germany invoice."
        actions={
          <Badge variant="outline" className="font-mono text-xs">
            {INVOICE.carrier} · {INVOICE.glsInvoiceNo}
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Input files</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FILES.map((f) => {
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
                        Parsed
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
          <h2 className="text-sm font-semibold">Invoice metadata</h2>
          <Card>
            <CardContent className="p-6">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {META.map((m) => (
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
          The CSV carries {count(INVOICE.csvRows)} lines that become {count(INVOICE.shipmentRows)}{" "}
          parcel rows after invoice-level charges are split out - handled under Reconciliation.
        </p>
      </div>
    </>
  )
}
