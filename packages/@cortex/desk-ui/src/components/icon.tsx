import type { LucideIcon } from "lucide-react"

/**
 * Jedno miejsce na grubość kreski — inaczej ikony rozjeżdżają się między plikami.
 *
 * `klasa?: string | undefined`, a nie samo `klasa?: string`: powłoka cortex-next kompiluje
 * z `exactOptionalPropertyTypes`, przy którym „propa nie ma" i „propa jest i wynosi
 * undefined" to dwa różne typy. W JSX-ie to rozróżnienie nie niesie żadnej treści —
 * `klasa={warunek ? 'x' : undefined}` znaczy dokładnie to samo, co pominięcie propa —
 * więc typ ma je dopuszczać. Ta sama reguła obowiązuje w pozostałych komponentach Biurka.
 */
export function Icon({
  as: I,
  px = 16,
  className,
}: {
  as: LucideIcon
  px?: 12 | 14 | 16 | 20 | 24 | 32 | undefined
  className?: string | undefined
}) {
  const dash = px <= 14 ? 2 : px === 16 ? 1.75 : 1.5
  return <I size={px} strokeWidth={dash} className={className} aria-hidden focusable={false} />
}
