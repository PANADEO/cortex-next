import type { FidelityKey } from "./types"

// D6/§6.1 (design doc): limit obrazów referencyjnych, pochodna
// Server.MaxRequestSize cortex-proxy. Duplikat magicznej liczby z route.ts —
// świadomy, client/server to dwa różne bundle'e (wzorem use-object-url.ts).
export const MAX_REFERENCE_IMAGES = 3

export const VARIANT_COUNTS = [2, 4] as const
export const DEFAULT_VARIANT_COUNT = 2

export const FIDELITY_OPTIONS: { key: FidelityKey; label: string; description: string }[] = [
  {
    key: "high",
    label: "Wysoka",
    description: "Model trzyma się kompozycji i szczegółów załączonego obrazu.",
  },
  {
    key: "loose",
    label: "Swobodna",
    description: "Model traktuje załączony obraz jako luźną inspirację.",
  },
]

export const DEFAULT_FIDELITY: FidelityKey = "high"
