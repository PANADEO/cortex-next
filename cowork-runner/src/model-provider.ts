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
 * CoworkModelConfig: refs are already resolved to values here.
 */
export interface ResolvedModelConfig {
  provider: "anthropic" | "openai-compatible"
  modelId: string
  baseUrl?: string
  /** Resolved secret value (the app resolves credential refs before spawn). */
  apiKey?: string
  headers?: Record<string, string>
}

const DEFAULT_MODEL = process.env[ENV.model] ?? "anthropic/claude-sonnet-4-5"

/** Provider id used for OpenAI-compatible endpoints (cortex-proxy included). */
const OPENAI_COMPAT_PROVIDER_ID = "cortex-gateway"

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

  if (config.provider === "anthropic") {
    // Catalog provider: only re-register when transport actually deviates,
    // so catalog metadata (cost, context window) stays untouched by default.
    if (config.baseUrl || config.apiKey || config.headers) {
      registerProvider("anthropic", {
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(config.headers ? { headers: config.headers } : {}),
      })
    }
    return `anthropic/${config.modelId}`
  }

  if (!config.baseUrl) {
    console.error(
      "[cowork-runner] openai-compatible model config requires baseUrl - falling back to default model",
    )
    return DEFAULT_MODEL
  }
  registerProvider(OPENAI_COMPAT_PROVIDER_ID, {
    api: "openai-completions",
    baseUrl: config.baseUrl,
    // pi-ai requires a non-empty key even for keyless endpoints (local
    // Ollama/vLLM); the placeholder is sent but ignored by such servers.
    apiKey: config.apiKey ?? "no-key",
    ...(config.headers ? { headers: config.headers } : {}),
  })
  return `${OPENAI_COMPAT_PROVIDER_ID}/${config.modelId}`
}
