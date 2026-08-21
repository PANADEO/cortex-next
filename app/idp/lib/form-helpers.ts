import { z } from "zod"

export function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function mapTrimToNull<T extends object>(values: T): { [K in keyof T]: string | null } {
  const out: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === "string" ? trimToNull(v) : null
  }
  return out as { [K in keyof T]: string | null }
}

export const numericStringSchema = z
  .string()
  .regex(/^$|^-?\d+(\.\d+)?$/, "Must be numeric (decimal with dot)")

export const countryCodeSchema = z
  .string()
  .max(3)
  .regex(/^[A-Za-z]{0,3}$/, "ISO country code")
