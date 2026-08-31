import type { LucideIcon } from 'lucide-react'

/** Jedno miejsce na grubość kreski — inaczej ikony rozjeżdżają się między plikami. */
export function Ikona({ jako: I, px = 16, klasa }: { jako: LucideIcon; px?: 12 | 14 | 16 | 20 | 24 | 32; klasa?: string }) {
  const kreska = px <= 14 ? 2 : px === 16 ? 1.75 : 1.5
  return <I size={px} strokeWidth={kreska} className={klasa} aria-hidden focusable={false} />
}
