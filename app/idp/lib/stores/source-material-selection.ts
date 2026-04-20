"use client"

import type { InvoiceLineSourceReference, NormalizedHighlightBox } from "@cortex/types"
import { create } from "zustand"

interface SourceMaterialSelectionState {
  activePath: string | null
  activePage: number | null
  highlightBoxes: NormalizedHighlightBox[]
  selectLineRefs: (refs: InvoiceLineSourceReference[]) => void
  setActivePath: (path: string | null) => void
  clear: () => void
}

function boxesEqual(a: NormalizedHighlightBox[], b: NormalizedHighlightBox[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    if (ai.x !== bi.x || ai.y !== bi.y || ai.width !== bi.width || ai.height !== bi.height) {
      return false
    }
  }
  return true
}

export const useSourceMaterialSelectionStore = create<SourceMaterialSelectionState>()(
  (set, get) => ({
    activePath: null,
    activePage: null,
    highlightBoxes: [],
    selectLineRefs: (refs) => {
      const first = refs[0]
      const state = get()
      if (!first) {
        if (state.activePage === null && state.highlightBoxes.length === 0) return
        set({ activePage: null, highlightBoxes: [] })
        return
      }
      if (
        state.activePath === first.path &&
        state.activePage === first.page_number &&
        boxesEqual(state.highlightBoxes, first.highlight_boxes)
      ) {
        return
      }
      set({
        activePath: first.path,
        activePage: first.page_number,
        highlightBoxes: first.highlight_boxes,
      })
    },
    setActivePath: (path) => {
      const state = get()
      if (state.activePath === path && state.activePage === null && state.highlightBoxes.length === 0) {
        return
      }
      set({ activePath: path, activePage: null, highlightBoxes: [] })
    },
    clear: () => {
      const state = get()
      if (
        state.activePath === null &&
        state.activePage === null &&
        state.highlightBoxes.length === 0
      ) {
        return
      }
      set({ activePath: null, activePage: null, highlightBoxes: [] })
    },
  }),
)
