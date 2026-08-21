"use client"

import { CLIENT_SUMMARY, GRAND_TOTAL, MARGIN, SP_MARKUP } from "@/features/store-pit/dataset"
import { ACCENT_DOT, CLIENT_META, count, eur, pct, signedEur } from "@/features/store-pit/helpers"
import type { ClientKey } from "@/features/store-pit/types"
import { Badge, Button, Card, CardContent, DataCard, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { ArrowUpRight, Percent, Receipt, TrendingUp, Wallet } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export default function ReRatingPage() {
  const { t } = useTranslation("store-pit")

  return (
    <>
      <PageHeader
        title={t("reRating.title")}
        description={t("reRating.description")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/store-pit/clients">
              {t("clients.title")}
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {/* KPI row */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard label={t("fields.glsCost")} value={eur(GRAND_TOTAL.glsTotal)} icon={Receipt} />
          <DataCard
            label={t("fields.storePitPrice")}
            value={eur(GRAND_TOTAL.spTotal)}
            icon={Wallet}
          />
          <DataCard
            label={t("reRating.cards.spMargin")}
            value={signedEur(MARGIN.total)}
            description={t("reRating.cards.marginOnGrandTotal", { pct: pct(MARGIN.pct) })}
            icon={TrendingUp}
            tone="success"
          />
          <DataCard
            label={t("reRating.cards.marginSplit")}
            value={signedEur(MARGIN.freight)}
            description={t("reRating.cards.surchargeAmount", {
              value: signedEur(MARGIN.surcharge),
            })}
            icon={Percent}
          />
        </section>

        {/* Pricing rules table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("reRating.rulesTitle")}</h2>
            <span className="text-xs text-muted-foreground">{t("reRating.rulesNote")}</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{t("markupTable.rule")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("markupTable.pricingBasis")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("markupTable.formula")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("markupTable.notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SP_MARKUP.map((row) => (
                      <tr
                        key={row.rule}
                        className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 font-medium">{row.rule}</td>
                        <td className="px-3 py-3 text-muted-foreground">{row.basis}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {row.formula}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Per-client breakdown: GLS cost to SP price */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("reRating.breakdownTitle")}</h2>
            <span className="text-xs text-muted-foreground">{t("reRating.breakdownNote")}</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="border-b border-border text-left uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{t("fields.client")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("fields.parcels")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.glsFreight")}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.glsSurcharge")}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.glsTotal")}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.spFreight")}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.spSurcharge")}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        {t("reRating.columns.spTotal")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">{t("fields.margin")}</th>
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
                          <td className="px-3 py-3 text-right tabular-nums">{count(c.qty)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(c.glsFreight)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(c.glsSurcharge)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{eur(c.glsTotal)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(c.spFreight)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(c.spSurcharge)}
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
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-4 py-3">{t("fields.grandTotal")}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {count(GRAND_TOTAL.qty)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.glsFreight)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.glsSurcharge)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.glsTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.spFreight)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.spSurcharge)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {eur(GRAND_TOTAL.spTotal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-success-foreground">
                        {signedEur(MARGIN.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Margin build breakdown */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("reRating.marginBuildTitle")}</h2>
          <Card>
            <CardContent className="py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{t("reRating.margin.freight")}</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-success-foreground">
                    {signedEur(MARGIN.freight)}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      ({pct(MARGIN.freight / GRAND_TOTAL.glsFreight)})
                    </span>
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{t("reRating.margin.surcharge")}</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-success-foreground">
                    {signedEur(MARGIN.surcharge)}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      ({pct(MARGIN.surcharge / GRAND_TOTAL.glsSurcharge)})
                    </span>
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{t("reRating.margin.total")}</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-success-foreground">
                    {signedEur(MARGIN.total)}
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      ({pct(MARGIN.pct)})
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
