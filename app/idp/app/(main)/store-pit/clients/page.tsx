"use client"

import { CLIENT_SUMMARY, GRAND_TOTAL, MARGIN } from "@/features/store-pit/dataset"
import { ACCENT_DOT, CLIENT_META, count, eur, pct, signedEur } from "@/features/store-pit/helpers"
import type { ClientKey } from "@/features/store-pit/types"
import { Badge, Card, CardContent, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Per-client settlement - the view each brand receives."
        actions={<span className="text-xs text-muted-foreground">4 clients</span>}
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.values(CLIENT_META).map((meta) => {
            const summary = CLIENT_SUMMARY.find((c) => c.client === meta.key)
            const margin = (summary?.spTotal ?? 0) - (summary?.glsTotal ?? 0)
            return (
              <Link key={meta.key} href={`/store-pit/clients/${meta.slug}`}>
                <Card className="cursor-pointer transition-colors hover:border-primary/40">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", ACCENT_DOT[meta.accent])} />
                      <span className="text-sm font-medium">{meta.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {meta.market}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold tabular-nums">
                        {eur(summary?.spTotal ?? 0)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {meta.pricingBasis}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Parcels</div>
                        <div className="font-medium tabular-nums">{count(summary?.qty ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">GLS cost</div>
                        <div className="tabular-nums">{eur(summary?.glsTotal ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Margin</div>
                        <div className="tabular-nums text-success-foreground">
                          {signedEur(margin)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Settlement summary</h2>
            <span className="text-xs text-muted-foreground">GLS cost - Store-Pit price</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-3 py-2.5 font-medium">Pricing rule</th>
                      <th className="px-3 py-2.5 text-right font-medium">Parcels</th>
                      <th className="px-3 py-2.5 text-right font-medium">GLS cost</th>
                      <th className="px-3 py-2.5 text-right font-medium">Store-Pit price</th>
                      <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                      <th className="w-8 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {CLIENT_SUMMARY.map((c) => {
                      const meta = CLIENT_META[c.client as ClientKey]
                      const margin = c.spTotal - c.glsTotal
                      const marginPct = c.glsTotal > 0 ? margin / c.glsTotal : 0
                      return (
                        <tr
                          key={c.client}
                          className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/store-pit/clients/${meta?.slug ?? ""}`}
                              className="flex items-center gap-2 font-medium hover:underline"
                            >
                              <span
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full",
                                  meta ? ACCENT_DOT[meta.accent] : "bg-muted",
                                )}
                              />
                              {c.client}
                              <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                                {meta?.market}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {meta?.pricingRule}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{count(c.qty)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(c.glsTotal)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {eur(c.spTotal)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-medium tabular-nums text-success-foreground">
                              {signedEur(margin)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {pct(marginPct)}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-4 py-3" colSpan={2}>
                        Grand total
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {count(GRAND_TOTAL.qty)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.glsTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.spTotal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-success-foreground">
                        {signedEur(MARGIN.total)}
                      </td>
                      <td className="px-2 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
