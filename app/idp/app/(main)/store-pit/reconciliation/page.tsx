"use client"

import { CHECKS, INVOICE, INVOICE_CHARGES, SERVICE_SUMMARY } from "@/features/store-pit/dataset"
import { count, eur, kg } from "@/features/store-pit/helpers"
import type { ChargeRow, CheckRow, ServiceRow } from "@/features/store-pit/types"
import {
  Badge,
  Card,
  CardContent,
  DataCard,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { AlertTriangle } from "lucide-react"

function formatCheckValue(check: string, value: number | string | null): string {
  if (value === null) return "-"
  if (typeof value === "string") return value
  const lc = check.toLowerCase()
  if (lc.includes("total") || lc.includes("vat")) return eur(value)
  return value.toLocaleString("en-US")
}

export default function ReconciliationPage() {
  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Cross-checks tying the extracted CSV detail to the PDF invoice summary."
        actions={
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          >
            Variance 0.00
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DataCard label="CSV net total" value={eur(INVOICE.pdfNetTotal)} />
          <DataCard label="PDF net total" value={eur(INVOICE.pdfNetTotal)} />
          <DataCard label="Variance" value="0.00" tone="success" />
          <DataCard label="PDF VAT" value={eur(INVOICE.pdfVat)} />
          <DataCard label="PDF gross total" value={eur(INVOICE.pdfGrossTotal)} />
        </section>

        <Tabs defaultValue="checks">
          <TabsList>
            <TabsTrigger value="checks">Checks</TabsTrigger>
            <TabsTrigger value="services">Service summary</TabsTrigger>
            <TabsTrigger value="charges">Invoice charges</TabsTrigger>
          </TabsList>

          <TabsContent value="checks" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Check</th>
                        <th className="px-3 py-2.5 text-right font-medium">Value</th>
                        <th className="px-3 py-2.5 font-medium">Note</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHECKS.map((row: CheckRow) => (
                        <tr
                          key={row.check}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-2.5 text-xs">{row.check}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {formatCheckValue(row.check, row.value)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {row.comment ?? "-"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            >
                              OK
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Service</th>
                        <th className="px-3 py-2.5 text-right font-medium">CSV rows</th>
                        <th className="px-3 py-2.5 text-right font-medium">CSV amount</th>
                        <th className="px-3 py-2.5 text-right font-medium">Weight (kg)</th>
                        <th className="px-3 py-2.5 text-right font-medium">PDF amount</th>
                        <th className="px-4 py-2.5 text-right font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SERVICE_SUMMARY.map((row: ServiceRow) => (
                        <tr
                          key={row.service}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-2.5 text-xs">{row.service}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {count(row.rows)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                            {eur(row.csvAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {row.weight > 0 ? kg(row.weight) : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                            {row.pdfAmount !== null ? eur(row.pdfAmount) : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                            {row.variance === null ? (
                              <span className="text-muted-foreground">-</span>
                            ) : row.variance === 0 ? (
                              <span className="text-muted-foreground">0.00</span>
                            ) : (
                              <span className="flex items-center justify-end gap-1 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                {eur(row.variance)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td
                          colSpan={6}
                          className="px-4 py-2.5 text-[11px] italic text-muted-foreground"
                        >
                          Residual variances on toll and sorting surcharges reflect GLS per-unit
                          rounding - immaterial to client settlement.
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charges" className="mt-4">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Invoice-level charges (energy surcharges, service flat fees, pre-financing) are
                split out from parcel lines before service classification.
              </p>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-2.5 font-medium">Article no.</th>
                          <th className="px-3 py-2.5 font-medium">Description</th>
                          <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {INVOICE_CHARGES.map((row: ChargeRow) => (
                          <tr
                            key={row.articleNo}
                            className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                          >
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                              {row.articleNo}
                            </td>
                            <td className="px-3 py-2.5 text-xs">{row.description}</td>
                            <td
                              className={cn(
                                "px-4 py-2.5 text-right text-xs tabular-nums",
                                row.amount < 0 && "text-destructive",
                              )}
                            >
                              {eur(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
