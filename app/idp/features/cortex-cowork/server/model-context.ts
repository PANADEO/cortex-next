import type { CoworkModelConfig } from "@cortex/types"

// Context-window sizes (tokens) for the models the tile can be pointed at.
// Flue's usage response carries no window size, so the app keeps this lookup
// for the session context meter. Matched by substring so version suffixes
// ("claude-sonnet-4-5-20250...") still resolve; falls back to a conservative
// default for unknown / self-hosted models.
const CONTEXT_WINDOWS: Array<{ match: RegExp; window: number }> = [
  { match: /claude.*(opus|sonnet|haiku)/i, window: 200_000 },
  { match: /gpt-4\.1|gpt-4o|o[134]/i, window: 128_000 },
  { match: /gpt-oss|qwen|llama|mistral|deepseek|glm/i, window: 128_000 },
]

const DEFAULT_CONTEXT_WINDOW = 128_000

export function contextWindowFor(model: Pick<CoworkModelConfig, "modelId">): number {
  const hit = CONTEXT_WINDOWS.find((entry) => entry.match.test(model.modelId))
  return hit?.window ?? DEFAULT_CONTEXT_WINDOW
}
