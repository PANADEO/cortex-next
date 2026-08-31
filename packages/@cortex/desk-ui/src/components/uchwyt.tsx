'use client'
import { useRef } from 'react'

export const SZER_MIN = 320
export const SZER_DOM = 360
/** Poniżej tej szerokości panel przestaje być panelem — zwijamy go zamiast miażdżyć treść. */
export const SZER_ZWIN = 264

export const szerMax = () => Math.min(760, Math.round(window.innerWidth * 0.6))
export const zacisnij = (px: number) => Math.min(Math.max(px, SZER_MIN), szerMax())

/**
 * Krawędź panelu wyniku jest chwytna, bo szerokość dokumentu to rzecz osobista:
 * tabela chce więcej miejsca, rozmowa mniej. Dociągnięcie do prawej zwija panel —
 * tak zachowuje się każdy pasek boczny, którego ci ludzie używali wcześniej,
 * więc nie ma tu czego się uczyć.
 */
export function UchwytPanelu({ szerokosc, ustaw, zwin }: {
  szerokosc: number
  ustaw: (px: number) => void
  zwin: () => void
}) {
  const ciagnie = useRef(false)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Szerokość panelu wyniku"
      aria-valuenow={szerokosc}
      aria-valuemin={SZER_MIN}
      tabIndex={0}
      title="Przeciągnij, żeby zmienić szerokość. Dociągnij do prawej, żeby zwinąć."
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        ciagnie.current = true
      }}
      onPointerMove={(e) => {
        if (!ciagnie.current) return
        const chciana = window.innerWidth - e.clientX
        if (chciana < SZER_ZWIN) { ciagnie.current = false; zwin(); return }
        ustaw(zacisnij(chciana))
      }}
      onPointerUp={(e) => {
        ciagnie.current = false
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={() => ustaw(SZER_DOM)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); ustaw(zacisnij(szerokosc + 24)) }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          if (szerokosc - 24 < SZER_ZWIN) zwin(); else ustaw(szerokosc - 24)
        }
      }}
      className="group/uchwyt relative hidden w-2 shrink-0 cursor-col-resize touch-none select-none lg:block focus-visible:outline-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover/uchwyt:bg-akcent group-focus-visible/uchwyt:bg-akcent" />
    </div>
  )
}
