export function formatRoute(from: string | null, to: string | null): string | null {
  if (!from && !to) return null
  return `${from ?? "?"} → ${to ?? "?"}`
}
