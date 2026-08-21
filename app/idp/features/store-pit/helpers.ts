import { formatMoney, formatQuantity, formatWeight } from "@cortex/utils"
import type { ClientKey } from "./types"

/** EUR money, English formatting (the GLS DE invoice settles in EUR). */
export function eur(value: number): string {
  return formatMoney(value.toFixed(2), { currency: "EUR", locale: "en-US" })
}

export function kg(value: number): string {
  return formatWeight(value.toFixed(2), { locale: "en-US" })
}

export function count(value: number): string {
  return formatQuantity(String(value), { locale: "en-US" })
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function signedEur(value: number): string {
  return `${value >= 0 ? "+" : "-"}${eur(Math.abs(value))}`
}

export type AccentKey = "sky" | "violet" | "emerald" | "amber"

interface ClientMeta {
  key: ClientKey
  slug: string
  name: string
  market: string
  pricingBasisKey: string
  pricingRuleKey: string
  accent: AccentKey
}

/**
 * Per-client metadata: how each brand is re-rated and where it ships.
 *
 * `name` i `market` zostają daną — nazwa własna klienta i kody krajów. Opisy
 * wyceny są już interfejsem, więc trzymamy tu KLUCZE przestrzeni `store-pit`,
 * nie napisy: ten plik nie jest komponentem i nie ma dostępu do `t`.
 */
export const CLIENT_META: Record<ClientKey, ClientMeta> = {
  FlatPay: {
    key: "FlatPay",
    slug: "flatpay",
    name: "FlatPay",
    market: "DE / FR / NL",
    pricingBasisKey: "clientMeta.flatpay.basis",
    pricingRuleKey: "clientMeta.flatpay.rule",
    accent: "sky",
  },
  Braintimizer: {
    key: "Braintimizer",
    slug: "braintimizer",
    name: "Braintimizer",
    market: "DK",
    pricingBasisKey: "clientMeta.braintimizer.basis",
    pricingRuleKey: "clientMeta.braintimizer.rule",
    accent: "violet",
  },
  Drywear: {
    key: "Drywear",
    slug: "drywear",
    name: "Drywear",
    market: "DE",
    pricingBasisKey: "clientMeta.drywear.basis",
    pricingRuleKey: "clientMeta.drywear.rule",
    accent: "emerald",
  },
  Nordvio: {
    key: "Nordvio",
    slug: "nordvio",
    name: "Nordvio",
    market: "DE",
    pricingBasisKey: "clientMeta.nordvio.basis",
    pricingRuleKey: "clientMeta.nordvio.rule",
    accent: "amber",
  },
}

const SLUG_TO_KEY: Record<string, ClientKey> = {
  flatpay: "FlatPay",
  braintimizer: "Braintimizer",
  drywear: "Drywear",
  nordvio: "Nordvio",
}

export function clientKeyFromSlug(slug: string): ClientKey | null {
  return SLUG_TO_KEY[slug] ?? null
}

export const ACCENT_BADGE: Record<AccentKey, string> = {
  sky: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  violet: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
}

export const ACCENT_DOT: Record<AccentKey, string> = {
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
}
