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

export const useSourceMaterialSelectionStore = create<SourceMaterialSelectionState>()((set) => ({
  activePath: null,
  activePage: null,
  highlightBoxes: [],
  selectLineRefs: (refs) => {
    const first = refs[0]
    if (!first) {
      set({ activePage: null, highlightBoxes: [] })
      return
    }
    set({
      activePath: first.path,
      activePage: first.page_number,
      highlightBoxes: first.highlight_boxes,
    })
  },
  setActivePath: (path) => set({ activePath: path, activePage: null, highlightBoxes: [] }),
  clear: () => set({ activePath: null, activePage: null, highlightBoxes: [] }),
}))
