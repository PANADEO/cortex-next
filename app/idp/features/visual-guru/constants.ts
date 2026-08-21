import type { FidelityKey } from "./types"

// D6/§6.1 (design doc): limit obrazów referencyjnych, pochodna
// Server.MaxRequestSize cortex-proxy. Duplikat magicznej liczby z route.ts —
// świadomy, client/server to dwa różne bundle'e (wzorem use-object-url.ts).
export const MAX_REFERENCE_IMAGES = 3

export const VARIANT_COUNTS = [2, 4] as const
export const DEFAULT_VARIANT_COUNT = 2

// Sama KOLEJNOŚĆ opcji; napis i tooltip biorą się z
// `generator.fidelity.<key>.{label,description}` w przestrzeni `visual-guru`.
export const FIDELITY_OPTIONS: { key: FidelityKey }[] = [{ key: "high" }, { key: "loose" }]

export const DEFAULT_FIDELITY: FidelityKey = "high"
