import { cn } from "@cortex/utils"

/**
 * Pasek postępu — WARTOŚĆ WZGLĘDEM STAŁEGO `max` (domyślnie 100), nie
 * względem sąsiednich pasków jak `BarList` (`components/bar-list.tsx`).
 * Celowo BEZ Radix: `@radix-ui/react-progress` nie jest dziś zależnością tego
 * repo (sprawdzone w package.json), a determinowany pasek postępu nie
 * wymaga żadnej z rzeczy, które Radix by dołożył (brak interakcji
 * klawiatury/focus — to nie kontrolka, tylko wskaźnik) — zgodnie z zasadą
 * CLAUDE.md "unikaj nowych zależności, chyba że już są w repo".
 *
 * Pierwszy konsument: `/geo-score-calculator` (4 paski wymiarów oceny).
 */
interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  /** Wartość 0..max. Spoza zakresu jest przycinana, nie wywala erroru. */
  value: number
  max?: number
  /** Nadpisuje kolor wypełnienia (domyślnie `bg-primary`) — np. tokeny
   *  success/warning/destructive dla pasków ocenianych progowo. */
  indicatorClassName?: string
}

function Progress({ value, max = 100, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.min(max, Math.max(0, value))
  const percent = max > 0 ? (clamped / max) * 100 : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width]", indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export { Progress }
