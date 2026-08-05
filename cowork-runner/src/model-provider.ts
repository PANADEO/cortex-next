import { registerProvider } from "@flue/runtime"
import { ENV, readJsonEnv } from "./env.ts"

// The single place where LLM transport is decided. Everything the runner
// sends to a model goes through the provider registered here, so cutting the
// whole tile over to cortex-proxy (or any OpenAI-compatible gateway) is a
// config change, not a code change.
//
// The app passes the per-project model config through the COWORK_MODEL_CONFIG
// env var (JSON) rather than workflow --input: the resolved API key must not
// appear in `ps` output, and env vars don't.

/**
 * Resolved model config as serialized by the app's chat-engine (its
 * `modelConfigForRunner`). Mirrors - but is NOT - @cortex/types'
 * CoworkModelConfig: refs are already resolved to values here, and this runner
 * is a standalone project that cannot import the app's types, so the shape has
 * to be restated on this side of the env-var contract. Keep the two in sync:
 * the native "anthropic" arm was dropped from BOTH on 05.08.2026, when every
 * project moved behind cortex-proxy.
 *
 * `provider` is declared but deliberately NOT read here - configureModel()
 * hardcodes the OpenAI-completions transport, since that is now the only one.
 * It stays on the wire because the APP side still needs it: isModelConfig()
 * (app/api/cortex-config/projects/validation.ts) uses it to reject a write
 * trying to persist the removed "anthropic" value. Dropping it from this
 * interface would only hide what the app actually sends.
 */
export interface ResolvedModelConfig {
  provider: "openai-compatible"
  modelId: string
  baseUrl?: string
  /** Resolved secret value (the app resolves credential refs before spawn). */
  apiKey?: string
  headers?: Record<string, string>
}

const DEFAULT_MODEL = process.env[ENV.model] ?? "anthropic/claude-sonnet-4-5"

/** Provider id used for OpenAI-compatible endpoints (cortex-proxy included). */
const OPENAI_COMPAT_PROVIDER_ID = "cortex-gateway"

// "cortex-gateway" is not a Flue catalog provider id, so registerProvider()
// has no catalog metadata to fall back on: per Flue's HttpProviderRegistration
// docs, both maxTokens and contextWindow fall back to 0 ("unknown") when the
// provider id isn't a known catalog entry. maxTokens: 0 silently caps every
// completion at ~1 output token (confirmed live: OpenRouter responses came
// back with finish_reason: "length" / native_finish_reason: "max_tokens"),
// which breaks chat entirely and makes tool-calling turns (web-search,
// image-gen) impossible since the model never gets enough budget to emit a
// tool call. contextWindow: 0 has the same failure class for input-side
// budgeting even though it wasn't the reported symptom.
//
// cortex-proxy fans out to whatever OpenRouter model the project picks
// (Claude, Perplexity, Gemini, ...), each with a genuinely different real
// limit, so there is no single "correct" value here. These are blanket
// stopgap defaults - not per-model tuned - chosen to comfortably fit a normal
// multi-turn chat reply plus tool-call arguments without being large enough
// to make a runaway completion expensive, and 128000 context tokens is a
// conservative baseline most 2026-era models meet or exceed. If a specific
// model needs more (e.g. very long context Gemini) or should be capped
// tighter, add it to `models` in the registerProvider() call below rather
// than changing this default, or make it project-configurable via
// ResolvedModelConfig.
//
// maxTokens was originally 8192, which turned out to be a real, reachable
// ceiling, not just a theoretical one: dotacje-desk (one of the 3 seeded demo
// projects, all of which route through this provider on anthropic/claude-
// opus-4.8 - see scripts/seed-demo.mjs) generates long formal grant-
// application documents, and a live repro truncated a ~6000-word essay
// exactly at 8192 output tokens (finish_reason: "length"). Bumped to 65536:
// confirmed live against OpenRouter's model catalog
// (https://openrouter.ai/api/v1/models) that anthropic/claude-opus-4.8's
// real ceiling is top_provider.max_completion_tokens: 128000, matching
// Anthropic's own documented 128K output cap for Opus 4.8. 65536 is half of
// that real ceiling - comfortably covers even a very long multi-section
// grant application (tens of thousands of words of headroom beyond the
// bug's repro case) while still being a bounded stopgap rather than "just
// use the model's actual max".
const DEFAULT_MAX_TOKENS = 65_536
const DEFAULT_CONTEXT_WINDOW = 128_000

export function readModelConfigFromEnv(): ResolvedModelConfig | undefined {
  return readJsonEnv<ResolvedModelConfig | undefined>(ENV.modelConfig, undefined)
}

/**
 * Registers the configured provider with Flue and returns the model
 * specifier (`providerId/modelId`) for `defineAgent`. No config falls back
 * to the legacy COWORK_MODEL env specifier, which keeps `flue run` working
 * standalone (dev, tests) without the app in front of it.
 */
export function configureModel(config: ResolvedModelConfig | undefined): string {
  if (!config) return DEFAULT_MODEL

  // The app always sets baseUrl now (modelConfigForRunner injects
  // CORTEX_PROXY_URL per turn), so this only catches a hand-written
  // COWORK_MODEL_CONFIG in standalone `flue run` use.
  if (!config.baseUrl) {
    console.error(
      "[cowork-runner] model config requires baseUrl (cortex-proxy endpoint) - falling back to default model",
    )
    return DEFAULT_MODEL
  }
  registerProvider(OPENAI_COMPAT_PROVIDER_ID, {
    api: "openai-completions",
    baseUrl: config.baseUrl,
    // pi-ai requires a non-empty key even for keyless endpoints (local
    // Ollama/vLLM); the placeholder is sent but ignored by such servers.
    apiKey: config.apiKey ?? "no-key",
    // See DEFAULT_MAX_TOKENS/DEFAULT_CONTEXT_WINDOW above: without these,
    // both fall back to 0 for this non-catalog provider id and silently
    // truncate every completion to ~1 token.
    maxTokens: DEFAULT_MAX_TOKENS,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    ...(config.headers ? { headers: config.headers } : {}),
  })
  return `${OPENAI_COMPAT_PROVIDER_ID}/${config.modelId}`
}
