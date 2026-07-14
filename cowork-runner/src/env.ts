// The runner's half of the app<->runner env contract. Every COWORK_* variable
// the app's chat-engine sets is read HERE and only here, so the contract has
// one place to drift-check against chat-engine.ts (which serializes it).
// Payload types mirror the app's resolved shapes; the runner stays standalone
// (no @cortex/* dependency), so the mirroring is deliberate and localized.

export const ENV = {
  /** Session sandbox dir on the host (mounts at /workspace in docker mode). */
  sandboxDir: "COWORK_SANDBOX_DIR",
  /** JSON: resolved model config (provider, modelId, baseUrl?, apiKey?, headers?). */
  modelConfig: "COWORK_MODEL_CONFIG",
  /** Extra system prompt appended to the base instructions. */
  systemPrompt: "COWORK_SYSTEM_PROMPT",
  /** "local" | "docker". */
  sandboxMode: "COWORK_SANDBOX_MODE",
  /** JSON: string[] of host paths (":ro" suffix = read-only mount). */
  sandboxPaths: "COWORK_SANDBOX_PATHS",
  /** Container image override for the docker sandbox. */
  sandboxImage: "COWORK_SANDBOX_IMAGE",
  /** JSON: resolved connector list (see connectors.ts ResolvedConnector). */
  connectors: "COWORK_CONNECTORS",
  /** Legacy model specifier fallback for standalone runs. */
  model: "COWORK_MODEL",
  /** Skills source override for standalone runs (no app in front). */
  skillsDir: "COWORK_SKILLS_DIR",
} as const

/** Parses a JSON env var; malformed or missing values yield the fallback. */
export function readJsonEnv<T>(name: string, fallback: T): T {
  const raw = process.env[name]
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    console.error(`[cowork-runner] ${name} is not valid JSON - ignoring`)
    return fallback
  }
}
