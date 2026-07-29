// Rejestr układów ramki — port _LAYOUTS z core/composer.py.
//
// Rozmiar pola obrazu/tekstu liczy się RAZ w compose() (budżet wysokości jest
// identyczny niezależnie od kolejności obraz/tekst), a układ decyduje tylko
// GDZIE co postawić. Dodanie nowego układu to nowa funkcja o tym samym
// podpisie + wpis w rejestrze, bez ruszania reszty compose().
//
// Układ "full-bleed" (obraz na cały kafelek, tekst na scrimie) to inna klasa
// problemu — potrzebowałby innej ścieżki liczenia rozmiarów, nie tylko nowej
// funkcji placement. Świadomie poza zakresem MVP, tak samo jak w PoC.

import type { FrameLayout } from "./types"

export interface PlacementInput {
  padding: number
  imageHeight: number
  textBlockHeight: number
}

export interface Placement {
  imageTop: number
  textTop: number
}

export type PlacementFn = (input: PlacementInput) => Placement

/** Obraz u góry, tekst pod nim — domyślny, dotychczasowy układ. */
export const placeImageTop: PlacementFn = ({ padding, imageHeight }) => ({
  imageTop: padding,
  textTop: 2 * padding + imageHeight,
})

/** Tekst u góry, obraz pod nim. */
export const placeImageBottom: PlacementFn = ({ padding, textBlockHeight }) => ({
  textTop: padding,
  imageTop: 2 * padding + textBlockHeight,
})

export const LAYOUTS: Record<FrameLayout, PlacementFn> = {
  "image-top": placeImageTop,
  "image-bottom": placeImageBottom,
}

export function resolvePlacement(layout: string): PlacementFn {
  return LAYOUTS[layout as FrameLayout] ?? placeImageTop
}
