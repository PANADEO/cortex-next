/** Formatowanie liczb w jednym miejscu — inaczej separator tysięcy rozjeżdża
 *  się między kartami metryk, słupkami i tabelami. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("pl-PL")
}

export function formatShare(share: number): string {
  return `${share.toFixed(1)}%`
}
