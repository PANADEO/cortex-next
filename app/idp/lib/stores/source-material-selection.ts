"use client"

import { buildInvoiceLineSpreadsheetSearchTerms } from "@/lib/spreadsheet-source-search"
import type { InvoiceLine, InvoiceLineSourceReference, NormalizedHighlightBox } from "@cortex/types"
import type { SpreadsheetSearchTerm } from "@cortex/ui/components/spreadsheet-search"
import { create } from "zustand"

interface SourceMaterialSelectionState {
  activePath: string | null
  activePage: number | null
  highlightBoxes: NormalizedHighlightBox[]
  selectionLabel: string | null
  spreadsheetSearchTerms: SpreadsheetSearchTerm[]
  selectLine: (line: InvoiceLine) => void
  selectLineRefs: (
    refs: InvoiceLineSourceReference[],
    spreadsheetSearchTerms?: SpreadsheetSearchTerm[],
  ) => void
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

function termsEqual(a: SpreadsheetSearchTerm[], b: SpreadsheetSearchTerm[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    if (
      ai.key !== bi.key ||
      ai.value !== bi.value ||
      ai.numericValue !== bi.numericValue ||
      ai.allowSubstring !== bi.allowSubstring ||
      ai.weight !== bi.weight
    ) {
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
    selectionLabel: null,
    spreadsheetSearchTerms: [],
    selectLine: (line) => {
      get().selectLineRefs(line.source_references, buildInvoiceLineSpreadsheetSearchTerms(line))
    },
    selectLineRefs: (refs, spreadsheetSearchTerms = []) => {
      const first = refs[0]
      const state = get()
      if (!first) {
        if (
          state.activePage === null &&
          state.highlightBoxes.length === 0 &&
          state.selectionLabel === null &&
          state.spreadsheetSearchTerms.length === 0
        ) {
          return
        }
        set({
          activePage: null,
          highlightBoxes: [],
          selectionLabel: null,
          spreadsheetSearchTerms: [],
        })
        return
      }
      const selectionLabel = first.label || first.relation_type || first.path
      if (
        state.activePath === first.path &&
        state.activePage === first.page_number &&
        boxesEqual(state.highlightBoxes, first.highlight_boxes) &&
        state.selectionLabel === selectionLabel &&
        termsEqual(state.spreadsheetSearchTerms, spreadsheetSearchTerms)
      ) {
        return
      }
      set({
        activePath: first.path,
        activePage: first.page_number,
        highlightBoxes: first.highlight_boxes,
        selectionLabel,
        spreadsheetSearchTerms,
      })
    },
    setActivePath: (path) => {
      const state = get()
      if (
        state.activePath === path &&
        state.activePage === null &&
        state.highlightBoxes.length === 0 &&
        state.selectionLabel === null &&
        state.spreadsheetSearchTerms.length === 0
      ) {
        return
      }
      set({
        activePath: path,
        activePage: null,
        highlightBoxes: [],
        selectionLabel: null,
        spreadsheetSearchTerms: [],
      })
    },
    clear: () => {
      const state = get()
      if (
        state.activePath === null &&
        state.activePage === null &&
        state.highlightBoxes.length === 0 &&
        state.selectionLabel === null &&
        state.spreadsheetSearchTerms.length === 0
      ) {
        return
      }
      set({
        activePath: null,
        activePage: null,
        highlightBoxes: [],
        selectionLabel: null,
        spreadsheetSearchTerms: [],
      })
    },
  }),
)
