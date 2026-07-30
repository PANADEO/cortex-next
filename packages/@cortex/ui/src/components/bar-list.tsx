import { cn } from "@cortex/utils"

/**
 * Pozioma lista słupkowa — porównanie wartości w JEDNEJ kategorii.
 *
 * Dlaczego to, a nie biblioteka wykresów: wszystkie wykresy oryginału
 * (Plotly w Streamlicie) to dokładnie ten przypadek, a taki zbiór czyta się
 * lepiej z listy niż z wykresu kołowego — pięć kołowych przy kilkunastu
 * modelach to nieczytelna tęcza. Słupek to `div` o szerokości w procentach,
 * zero zależności, działa w obu motywach i skaluje się z szerokością kolumny.
 *
 * DWIE RÓŻNE LICZBY, celowo:
 *  - DŁUGOŚĆ słupka jest względem NAJWIĘKSZEJ pozycji na liście (jak oś
 *    wykresu słupkowego) — inaczej przy rozdrobnionych danych wszystkie
 *    słupki byłyby nieodróżnialnymi kreskami.
 *  - PROCENT w tekście to udział w SUMIE. Te dwie wartości nie są tym samym
 *    i nie wolno ich mylić.
 */
export interface BarListItem {
  label: string
  value: number
  /** Udział w sumie, 0..100. Pokazywany jako tekst, nie jako długość słupka. */
  share: number
  /** Dodatkowy opis pod etykietą, np. liczba żądań. */
  meta?: string
}

interface BarListProps {
  items: readonly BarListItem[]
  /** Domyślnie separator tysięcy wg locale przeglądarki. */
  formatValue?: (value: number) => string
  /** Obcięcie długiego ogona. Bez limitu renderuje wszystko. */
  maxItems?: number
  className?: string
}

function defaultFormat(value: number): string {
  return value.toLocaleString("pl-PL")
}

export function BarList({ items, formatValue = defaultFormat, maxItems, className }: BarListProps) {
  const visible = maxItems ? items.slice(0, maxItems) : items
  // Skala liczona z WIDOCZNYCH pozycji, nie z całości — po obcięciu ogona
  // najdłuższy słupek ma wypełniać wiersz, a nie zostawiać pustą przestrzeń.
  const max = visible.reduce((peak, item) => Math.max(peak, item.value), 0)

  return (
    <ul className={cn("space-y-2", className)}>
      {visible.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatValue(item.value)}</span>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {item.share.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              // Jedyna wartość, której nie da się wyrazić klasą Tailwinda —
              // szerokość jest DANĄ, nie decyzją projektową. Zero koloru,
              // zero spacingu: te idą wyłącznie przez tokeny.
              style={{ width: max > 0 ? `${(item.value / max) * 100}%` : "0%" }}
            />
          </div>
          {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
        </li>
      ))}
    </ul>
  )
}
