"use client"
import { useRef } from "react"

export const WIDTH_MIN = 320
export const WIDTH_DEFAULT = 360
/** Poniżej tej szerokości panel przestaje być panelem — zwijamy go zamiast miażdżyć treść. */
export const WIDTH_COLLAPSE = 264

export const maxWidth = () => Math.min(760, Math.round(window.innerWidth * 0.6))
export const clamp = (px: number) => Math.min(Math.max(px, WIDTH_MIN), maxWidth())

/**
 * Krawędź panelu wyniku jest chwytna, bo szerokość dokumentu to rzecz osobista:
 * tabela chce więcej miejsca, rozmowa mniej. Dociągnięcie do prawej zwija panel —
 * tak zachowuje się każdy pasek boczny, którego ci ludzie używali wcześniej,
 * więc nie ma tu czego się uczyć.
 */
export function PanelHandle({
  width,
  set,
  collapse,
}: {
  width: number
  set: (px: number) => void
  collapse: () => void
}) {
  const dragging = useRef(false)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Szerokość panelu wyniku"
      aria-valuenow={width}
      aria-valuemin={WIDTH_MIN}
      tabIndex={0}
      title="Przeciągnij, żeby zmienić szerokość. Dociągnij do prawej, żeby zwinąć."
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        dragging.current = true
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const wanted = window.innerWidth - e.clientX
        if (wanted < WIDTH_COLLAPSE) {
          dragging.current = false
          collapse()
          return
        }
        set(clamp(wanted))
      }}
      onPointerUp={(e) => {
        dragging.current = false
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={() => set(WIDTH_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          set(clamp(width + 24))
        }
        if (e.key === "ArrowRight") {
          e.preventDefault()
          if (width - 24 < WIDTH_COLLAPSE) collapse()
          else set(width - 24)
        }
      }}
      className="group/uchwyt relative hidden w-2 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-none lg:block"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover/uchwyt:bg-akcent group-focus-visible/uchwyt:bg-akcent" />
    </div>
  )
}
