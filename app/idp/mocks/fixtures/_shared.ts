export function pseudoRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function daysAgo(days: number, hourDrift = (days * 7) % 24): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - hourDrift)
  return d.toISOString()
}
