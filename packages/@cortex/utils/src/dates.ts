import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value)
}

export function formatAbsolute(value: string | Date, pattern = "yyyy-MM-dd HH:mm"): string {
  return format(toDate(value), pattern)
}

export function formatRelative(value: string | Date): string {
  return `${formatDistanceToNowStrict(toDate(value))} ago`
}

export function formatFileSizeMb(sizeMb: number | null | undefined, fallback = "—"): string {
  if (sizeMb == null || !Number.isFinite(sizeMb)) return fallback
  if (sizeMb < 1) return `${(sizeMb * 1024).toFixed(0)} KB`
  return `${sizeMb.toFixed(2)} MB`
}

export function formatFileSizeBytes(bytes: number | null | undefined, fallback = "—"): string {
  if (bytes == null || !Number.isFinite(bytes)) return fallback
  return formatFileSizeMb(bytes / (1024 * 1024), fallback)
}
