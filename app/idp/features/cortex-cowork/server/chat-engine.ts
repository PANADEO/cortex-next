import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import type { CoworkConnectorConfig, CoworkModelConfig, CoworkProjectConfig } from "@cortex/types"
import { composeAgentsPrompt } from "@cortex/types"
import type {
  AgentActivityStep,
  ChatMessage,
  CoworkArtifact,
  CoworkSessionUsage,
  CoworkSkillId,
} from "../types"
import {
  gateCredentials,
  readCredentialsDocument,
  resolveCredential,
  resolveCredentialRefs,
  type CredentialsDocument,
} from "@/lib/cortex-governance/credentials"
import { grantedConnectors, readGovernanceConfig } from "@/lib/cortex-governance/store"
import { readUserInstructions } from "@/lib/cortex-governance/user-instructions"
import { appendMessage, recordUsage, registerArtifact, type SandboxSession } from "./sandbox-store"
import { generateCsvExport } from "./skills/csv-export"
import { generateExcelReport } from "./skills/excel-report"

/** What one chat turn resolves to: the assistant message, new files, updated meter. */
export interface TurnResult {
  message: ChatMessage
  artifacts: CoworkArtifact[]
  usage: CoworkSessionUsage
}

interface RunnerResult {
  reply: string
  usage?: { input: number; output: number; totalTokens: number }
}

/**
 * LIVE agent turn, executed through the real Flue harness.
 *
 * Each turn spawns `flue run cowork-turn` in ../../../../../cowork-runner - a
 * standalone Flue (@flue/runtime 1.0.0-beta.9) project whose workflow drives
 * `harness.session().prompt()` against an agent with the tile's SKILL.md
 * packages registered and a `local()` sandbox. The agent works autonomously
 * (it can read/write files and run commands in its sandbox) and is instructed
 * to write deliverables under this session's artifacts/ directory; after the
 * run we diff that directory and register whatever files the model produced.
 *
 * Requirements (dev): `npm install --ignore-scripts` inside cowork-runner,
 * ANTHROPIC_API_KEY in the app env, and COWORK_NODE_BIN pointing at a
 * node >= 22.19 binary when the app itself runs on an older node (Flue's
 * pi-ai dependency needs 22.19+). Both env vars live in .env.local.
 *
 * If the runner is missing or the run fails, we degrade to a deterministic
 * keyword router over the same skill implementations so the chat never
 * hard-fails.
 */

const RUNNER_TIMEOUT_MS = 240_000
const HISTORY_TURNS = 12
// Marker prefix the runner's observe() bridge puts on each stderr NDJSON
// event line (see cowork-runner/src/observe-events.ts).
const EVENT_MARKER = "@@COWORK_EVT@@"
// Assistant text deltas are streamed live but not persisted as steps - the
// final message content already carries the authoritative text.
const PERSISTED_KINDS = new Set<AgentActivityStep["kind"]>([
  "thinking",
  "tool_start",
  "tool_end",
  "lifecycle",
])

function runnerDir(): string {
  return process.env.COWORK_RUNNER_DIR ?? path.join(process.cwd(), "cowork-runner")
}

/** Per-turn request context (who is asking - drives the AGENTS.md user layer). */
export interface ChatTurnOptions {
  userEmail?: string | undefined
}

export async function runChatTurn(
  session: SandboxSession,
  userContent: string,
  options: ChatTurnOptions = {},
): Promise<TurnResult> {
  return streamChatTurn(session, userContent, () => {}, options)
}

/**
 * Typed runner failure, classified AT THE THROW SITE (each site knows what
 * happened) instead of by regexing message text later. `retryable` marks
 * fast transients worth one more attempt: a crashed process, a reset socket.
 * A timeout is deliberately NOT retryable - the first attempt already burned
 * the full RUNNER_TIMEOUT_MS budget and a retry would double both the
 * user's wait and the model spend.
 */
class RunnerError extends Error {
  readonly retryable: boolean

  constructor(message: string, options: { retryable: boolean; cause?: unknown }) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.retryable = options.retryable
  }
}

/**
 * Runs one agent turn, invoking `onEvent` with each live activity step as the
 * Flue runner reports it (thinking, tool calls, assistant text progress).
 * Resolves with the persisted assistant message (including its activity
 * trail) and any new artifacts once the run completes. Transient failures get
 * one retry; anything else degrades to the keyword fallback.
 */
export async function streamChatTurn(
  session: SandboxSession,
  userContent: string,
  onEvent: (step: AgentActivityStep) => void,
  options: ChatTurnOptions = {},
): Promise<TurnResult> {
  for (const attempt of [1, 2]) {
    try {
      return await runFlueTurn(session, userContent, onEvent, options)
    } catch (error) {
      const retryable = error instanceof RunnerError && error.retryable && attempt === 1
      console.warn(
        `[cortex-cowork] Flue runner turn failed (attempt ${attempt}${retryable ? ", retrying" : ", falling back to keyword routing"}):`,
        error instanceof Error ? error.message : error,
      )
      if (!retryable) break
    }
  }
  return runKeywordFallback(session, userContent)
}

interface RunnerEvent {
  seq?: number
  ts?: string
  kind?: string
  tool?: string
  detail?: string
  text?: string
  isError?: boolean
}

function toActivityStep(raw: string): AgentActivityStep | null {
  let parsed: RunnerEvent
  try {
    parsed = JSON.parse(raw) as RunnerEvent
  } catch {
    return null
  }
  if (typeof parsed.kind !== "string") return null
  const kind = parsed.kind as AgentActivityStep["kind"]
  return {
    id: `step-${parsed.seq ?? randomUUID()}`,
    ts: parsed.ts ?? new Date().toISOString(),
    kind,
    ...(parsed.tool ? { tool: parsed.tool } : {}),
    ...(parsed.detail ? { detail: parsed.detail } : {}),
    ...(parsed.text ? { text: parsed.text } : {}),
    ...(parsed.isError ? { isError: true } : {}),
  }
}

/**
 * Builds the model config slice passed to the runner. Credential refs are
 * resolved app-side against a preloaded document (one file read covers the
 * model key and every connector this turn); an unset or unresolvable ref
 * falls through to the provider's own env-var lookup (ANTHROPIC_API_KEY et
 * al.) inside the runner process.
 */
function modelConfigForRunner(
  project: CoworkProjectConfig,
  credentials: CredentialsDocument,
): CoworkModelConfig {
  const apiKey = resolveCredential(credentials, project.model.apiKeyRef)
  return {
    provider: project.model.provider,
    modelId: project.model.modelId,
    ...(project.model.baseUrl ? { baseUrl: project.model.baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  }
}

// Mirrors ResolvedConnector in cowork-runner/src/connectors.ts (the runner is
// standalone, so the wire shape is declared on each side of the env contract).
interface ResolvedConnectorForRunner {
  id: string
  type: "mcp" | "cli"
  name: string
  description?: string
  target: string
  headers?: Record<string, string>
  env?: Record<string, string>
  baseArgs?: string[]
}

/** Enabled connectors with credential refs resolved to header/env values. */
function connectorsForRunner(
  connectors: CoworkConnectorConfig[],
  credentials: CredentialsDocument,
): ResolvedConnectorForRunner[] {
  return connectors
    .filter((connector) => connector.enabled)
    .map((connector) => {
      const secrets = resolveCredentialRefs(credentials, connector.credentialRefs)
      const hasSecrets = Object.keys(secrets).length > 0
      return {
        id: connector.id,
        type: connector.type,
        name: connector.name,
        ...(connector.description ? { description: connector.description } : {}),
        target: connector.target,
        ...(connector.type === "mcp" && hasSecrets ? { headers: secrets } : {}),
        ...(connector.type === "cli" && hasSecrets ? { env: secrets } : {}),
        ...(connector.baseArgs?.length ? { baseArgs: connector.baseArgs } : {}),
      }
    })
}

async function runFlueTurn(
  session: SandboxSession,
  userContent: string,
  onEvent: (step: AgentActivityStep) => void,
  options: ChatTurnOptions,
): Promise<TurnResult> {
  const dir = runnerDir()
  const flueCli = path.join(dir, "node_modules", "@flue", "cli", "bin", "flue.mjs")
  const nodeBin = process.env.COWORK_NODE_BIN ?? "node"
  const config = await readGovernanceConfig()
  const project = config.projects.find((candidate) => candidate.id === session.projectId)

  const before = await listArtifactFiles(session.artifactsDir)
  const input = JSON.stringify({
    message: userContent,
    sandboxDir: session.sandboxDir,
    history: buildHistory(session.messages),
  })

  // Prepend the runner node's bin dir so `node`/`npm` inside the agent's
  // local() sandbox resolve to the same (new enough) runtime.
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (process.env.COWORK_NODE_BIN) {
    env.PATH = `${path.dirname(process.env.COWORK_NODE_BIN)}:${env.PATH ?? ""}`
  }
  // Per-instance configuration travels via env, not argv: the model config
  // will carry resolved secrets, and env vars never show up in `ps` output.
  // (Env names are read on the runner side in cowork-runner/src/env.ts.)
  env.COWORK_SANDBOX_DIR = session.sandboxDir
  if (project) {
    // One credentials read covers the model key and every connector, gated to
    // the department secrets this project was granted.
    const credentials = gateCredentials(
      await readCredentialsDocument(),
      project.composition.secrets,
    )
    env.COWORK_MODEL_CONFIG = JSON.stringify(modelConfigForRunner(project, credentials))
    // Hierarchical AGENTS.md: organization -> department chain -> tile ->
    // the requesting user's personal note, composed into one system prompt.
    const composedPrompt = composeAgentsPrompt({
      instructions: config.agentsInstructions,
      projectDepartment: project.department,
      projectPrompt: project.systemPrompt,
      userPrompt: options.userEmail
        ? await readUserInstructions(options.userEmail)
        : undefined,
    })
    if (composedPrompt) env.COWORK_SYSTEM_PROMPT = composedPrompt
    // Configs written before sandbox modes existed carry no `mode` field.
    env.COWORK_SANDBOX_MODE = project.sandbox.mode ?? "local"
    if (project.sandbox.allowedPaths.length > 0) {
      env.COWORK_SANDBOX_PATHS = JSON.stringify(project.sandbox.allowedPaths)
    }
    const connectors = connectorsForRunner(grantedConnectors(config, project), credentials)
    if (connectors.length > 0) {
      env.COWORK_CONNECTORS = JSON.stringify(connectors)
    }
  }

  const activity: AgentActivityStep[] = []

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      nodeBin,
      [flueCli, "run", "cowork-turn", "--target", "node", "--input", input],
      { cwd: dir, env },
    )
    // SIGTERM first so the runner's exit handlers can tear down docker
    // sandbox containers; escalate to SIGKILL only if it hangs.
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref()
      // Not retryable: the attempt already consumed the full timeout budget.
      reject(
        new RunnerError(`flue run timed out after ${RUNNER_TIMEOUT_MS}ms`, { retryable: false }),
      )
    }, RUNNER_TIMEOUT_MS)

    let out = ""
    let errTail = ""
    let stderrBuffer = ""

    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      // Consume complete lines; keep a partial trailing line in the buffer.
      const lines = stderrBuffer.split("\n")
      stderrBuffer = lines.pop() ?? ""
      for (const line of lines) {
        if (line.startsWith(EVENT_MARKER)) {
          const step = toActivityStep(line.slice(EVENT_MARKER.length))
          if (step) {
            if (PERSISTED_KINDS.has(step.kind)) activity.push(step)
            onEvent(step)
          }
        } else if (line.trim()) {
          errTail = `${errTail}\n${line}`.slice(-2000)
        }
      }
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      // Spawn failure = missing binary / bad COWORK_NODE_BIN - structural,
      // a retry would fail identically.
      reject(new RunnerError(`flue spawn failed: ${error.message}`, { retryable: false }))
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      // A non-zero exit is the transient class (model call crashed, network
      // reset inside the runner) - worth exactly one more attempt.
      else
        reject(
          new RunnerError(`flue run exited with code ${code}: ${errTail.trim()}`, {
            retryable: true,
          }),
        )
    })
  })

  const result = extractResult(stdout)
  const newArtifacts = await registerNewArtifacts(session, before)

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: result.reply,
    createdAt: new Date().toISOString(),
    ...(newArtifacts[0] ? { skillInvoked: newArtifacts[0].skill } : {}),
    ...(activity.length > 0 ? { activity } : {}),
  }
  await appendMessage(session, message)
  if (result.usage) await recordUsage(session, result.usage)
  return { message, artifacts: newArtifacts, usage: session.usage }
}

/** Finds the workflow's terminal `{"reply": ..., "usage"?: ...}` line in output. */
function extractResult(stdout: string): RunnerResult {
  const lines = stdout.split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim()
    if (!line?.startsWith("{")) continue
    try {
      const parsed = JSON.parse(line) as RunnerResult
      if (typeof parsed.reply === "string") return parsed
    } catch {
      // not the result line - keep scanning
    }
  }
  throw new Error("no workflow result found in flue run output")
}

function buildHistory(messages: ChatMessage[]): string | undefined {
  // Skip the canned assistant welcome; keep the last few real turns.
  const turns = messages
    .filter((message, index) => !(index === 0 && message.role === "assistant"))
    .slice(-HISTORY_TURNS)
    .slice(0, -1) // the current user message is passed separately
  if (turns.length === 0) return undefined
  return turns
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
}

async function listArtifactFiles(artifactsDir: string): Promise<Set<string>> {
  const entries = await readdir(artifactsDir).catch(() => [] as string[])
  return new Set(entries)
}

const MIME_BY_EXT: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
}

// Best-effort attribution of an artifact to the skill that plausibly produced
// it (drives the badge in the Artifacts panel) - cosmetic, not governance.
const SKILL_BY_EXT: Record<string, CoworkSkillId> = {
  ".csv": "csv-export",
  ".xlsx": "excel-report",
  ".png": "visual-generate",
  ".jpg": "visual-generate",
  ".jpeg": "visual-generate",
  ".webp": "visual-generate",
}

function skillForFile(filename: string): CoworkSkillId {
  return SKILL_BY_EXT[path.extname(filename).toLowerCase()] ?? "sandbox"
}

/** Registers files the agent wrote to artifacts/ during this turn. */
async function registerNewArtifacts(
  session: SandboxSession,
  before: Set<string>,
): Promise<CoworkArtifact[]> {
  const after = await listArtifactFiles(session.artifactsDir)
  const newArtifacts: CoworkArtifact[] = []
  for (const filename of after) {
    if (before.has(filename)) continue
    const info = await stat(path.join(session.artifactsDir, filename)).catch(() => null)
    if (!info?.isFile()) continue
    const artifact: CoworkArtifact = {
      id: randomUUID(),
      filename,
      mimeType: MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
      sizeBytes: info.size,
      createdAt: new Date().toISOString(),
      skill: skillForFile(filename),
    }
    await registerArtifact(session, artifact)
    newArtifacts.push(artifact)
  }
  return newArtifacts
}

/**
 * Deterministic degrade path: keyword routing over the same skill recipes,
 * used only when the Flue runner is unavailable or its run fails.
 */
async function runKeywordFallback(
  session: SandboxSession,
  userContent: string,
): Promise<TurnResult> {
  // The fallback honors the same governance boundary as the runner: a skill
  // that was not copied into this session's sandbox does not exist here.
  const sessionSkillIds = new Set(session.skills.map((skill) => skill.id))
  const wantsCsv = sessionSkillIds.has("csv-export") && /\bcsv\b/i.test(userContent)
  const wantsExcel =
    !wantsCsv &&
    sessionSkillIds.has("excel-report") &&
    /excel|xlsx|arkusz|spreadsheet|raport|report/i.test(userContent)

  const newArtifacts: CoworkArtifact[] = []
  let replyLines: string[]

  if (wantsExcel) {
    const artifact = await generateExcelReport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "(Fallback mode - Flue runner unavailable.) Generated a workbook in the sandbox.",
      `Ready: ${artifact.filename} - grab it from the Artifacts panel.`,
    ]
  } else if (wantsCsv) {
    const artifact = await generateCsvExport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "(Fallback mode - Flue runner unavailable.) Wrote a CSV in the sandbox.",
      `Ready: ${artifact.filename} - grab it from the Artifacts panel.`,
    ]
  } else {
    replyLines = [
      "I work inside this session's sandbox and hand you back real files.",
      `Loaded skills: ${session.skills.map((skill) => skill.name).join(", ") || "none"}.`,
      'Ask for "an excel report" or "a csv export" and I will generate one you can download.',
    ]
  }

  for (const artifact of newArtifacts) {
    await registerArtifact(session, artifact)
  }

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: replyLines.join("\n\n"),
    createdAt: new Date().toISOString(),
    degraded: true,
    ...(newArtifacts[0] ? { skillInvoked: newArtifacts[0].skill } : {}),
  }
  await appendMessage(session, message)

  // No model call in the fallback path - the context meter is unchanged.
  return { message, artifacts: newArtifacts, usage: session.usage }
}
