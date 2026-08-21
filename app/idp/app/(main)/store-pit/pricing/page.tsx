"use client"

import { BT_PRICES, DAO_PRICES, SETTINGS, SP_MARKUP } from "@/features/store-pit/dataset"
import { count } from "@/features/store-pit/helpers"
import {
  Badge,
  Card,
  CardContent,
  Input,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function PricingPage() {
  const { t } = useTranslation("store-pit")
  const [daoSearch, setDaoSearch] = useState("")

  const q = daoSearch.trim().toLowerCase()
  const filteredDao = q
    ? DAO_PRICES.filter((d) => d.priceKey.toLowerCase().includes(q))
    : DAO_PRICES

  return (
    <>
      <PageHeader title={t("pricing.title")} description={t("pricing.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <p className="text-sm text-muted-foreground">{t("pricing.intro")}</p>

        <Tabs defaultValue="markup">
          <TabsList>
            <TabsTrigger value="markup">{t("pricing.tabs.markup")}</TabsTrigger>
            <TabsTrigger value="dao">{t("pricing.tabs.dao")}</TabsTrigger>
            <TabsTrigger value="braintimizer">{t("pricing.tabs.braintimizer")}</TabsTrigger>
            <TabsTrigger value="settings">{t("pricing.tabs.settings")}</TabsTrigger>
          </TabsList>

          {/* ── Mark-up rules ── */}
          <TabsContent value="markup" className="mt-4">
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
                      {SP_MARKUP.map((m, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3 text-sm font-medium">{m.rule}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{m.basis}</td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="font-mono text-xs">
                              {m.formula}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{m.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DAO price list ── */}
          <TabsContent value="dao" className="mt-4">
            <Card>
              <CardContent className="p-4 pb-0">
                <div className="mb-3 flex items-center gap-3">
                  <Input
                    placeholder={t("pricing.dao.filterPlaceholder")}
                    value={daoSearch}
                    onChange={(e) => setDaoSearch(e.target.value)}
                    className="h-9 w-80"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("pricing.dao.shownCount", {
                      shown: count(filteredDao.length),
                      total: count(DAO_PRICES.length),
                    })}
                  </span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("pricing.dao.tier")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("pricing.dao.priceKey")}</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("fields.storePitPrice")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDao.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-2.5">
                            {d.tier !== null ? (
                              <Badge variant="outline" className="text-xs">
                                {d.tier}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">{d.priceKey}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{count(d.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Braintimizer contract pricing ── */}
          <TabsContent value="braintimizer" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("fields.country")}</th>
                        <th className="px-3 py-2.5 text-right font-medium">
                          {t("pricing.bt.priceUnder5")}
                        </th>
                        <th className="px-4 py-2.5 font-medium">{t("pricing.bt.transit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BT_PRICES.map((b, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3">{b.country}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {b.priceDkkUnder5} DKK
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{b.transit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Invoice-level settings ── */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/40">
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{t("pricing.settings.setting")}</th>
                        <th className="px-3 py-2.5 font-medium">{t("pricing.settings.value")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("pricing.settings.source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SETTINGS.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3 font-medium">{s.setting}</td>
                          <td className="px-3 py-3 text-xs">{s.value}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{s.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
