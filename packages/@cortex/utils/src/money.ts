const MONEY_REGEX = /^-?\d+(\.\d+)?$/

export function isMoneyString(value: string): boolean {
  return MONEY_REGEX.test(value)
}

export function formatMoney(
  value: string | null | undefined,
  options: { currency?: string; locale?: string; fallback?: string } = {},
): string {
  const { currency = "USD", locale = "en-US", fallback = "—" } = options
  if (value == null || value === "") return fallback
  if (!isMoneyString(value)) return value

  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  }).format(asNumber)
}

export function formatWeight(
  value: string | null | undefined,
  options: { locale?: string; fallback?: string } = {},
): string {
  const { locale = "en-US", fallback = "—" } = options
  if (value == null || value === "") return fallback
  if (!isMoneyString(value)) return value

  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(asNumber)} kg`
}

export function formatQuantity(
  value: string | null | undefined,
  options: { locale?: string; unit?: string; fallback?: string } = {},
): string {
  const { locale = "en-US", unit, fallback = "—" } = options
  if (value == null || value === "") return fallback
  if (!isMoneyString(value)) return value

  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return value

  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(asNumber)
  return unit ? `${formatted} ${unit}` : formatted
}
