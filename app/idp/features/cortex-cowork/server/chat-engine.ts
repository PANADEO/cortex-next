import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import type { CoworkModelConfig, CoworkProjectConfig } from "@cortex/types"
import type { AgentActivityStep, ChatMessage, CoworkArtifact, CoworkSkillId } from "../types"
import { getProject } from "./config-store"
import { appendMessage, registerArtifact, type SandboxSession } from "./sandbox-store"
import { generateCsvExport } from "./skills/csv-export"
import { generateExcelReport } from "./skills/excel-report"

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

export async function runChatTurn(
  session: SandboxSession,
  userContent: string,
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  return streamChatTurn(session, userContent, () => {})
}

/**
 * Runs one agent turn, invoking `onEvent` with each live activity step as the
 * Flue runner reports it (thinking, tool calls, assistant text progress).
 * Resolves with the persisted assistant message (including its activity
 * trail) and any new artifacts once the run completes.
 */
export async function streamChatTurn(
  session: SandboxSession,
  userContent: string,
  onEvent: (step: AgentActivityStep) => void,
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  try {
    return await runFlueTurn(session, userContent, onEvent)
  } catch (error) {
    console.warn(
      "[cortex-cowork] Flue runner turn failed, falling back to keyword routing:",
      error instanceof Error ? error.message : error,
    )
    return runKeywordFallback(session, userContent)
  }
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
 * resolved app-side (the runner only ever sees final values); until the
 * credential store lands, unset refs fall through to the provider's own
 * env-var lookup (ANTHROPIC_API_KEY et al.) inside the runner process.
 */
function modelConfigForRunner(project: CoworkProjectConfig): CoworkModelConfig {
  return {
    provider: project.model.provider,
    modelId: project.model.modelId,
    ...(project.model.baseUrl ? { baseUrl: project.model.baseUrl } : {}),
  }
}

async function runFlueTurn(
  session: SandboxSession,
  userContent: string,
  onEvent: (step: AgentActivityStep) => void,
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  const dir = runnerDir()
  const flueCli = path.join(dir, "node_modules", "@flue", "cli", "bin", "flue.mjs")
  const nodeBin = process.env.COWORK_NODE_BIN ?? "node"
  const project = await getProject(session.projectId)

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
  env.COWORK_SANDBOX_DIR = session.sandboxDir
  if (project) {
    env.COWORK_MODEL_CONFIG = JSON.stringify(modelConfigForRunner(project))
    if (project.systemPrompt) env.COWORK_SYSTEM_PROMPT = project.systemPrompt
  }

  const activity: AgentActivityStep[] = []

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      nodeBin,
      [flueCli, "run", "cowork-turn", "--target", "node", "--input", input],
      { cwd: dir, env },
    )
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`flue run timed out after ${RUNNER_TIMEOUT_MS}ms`))
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
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`flue run exited with code ${code}: ${errTail.trim()}`))
    })
  })

  const reply = extractReply(stdout)
  const newArtifacts = await registerNewArtifacts(session, before)

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: reply,
    createdAt: new Date().toISOString(),
    ...(newArtifacts[0] ? { skillInvoked: newArtifacts[0].skill } : {}),
    ...(activity.length > 0 ? { activity } : {}),
  }
  await appendMessage(session, message)
  return { message, artifacts: newArtifacts }
}

/** Finds the workflow's terminal `{"reply": "..."}` line in `flue run` output. */
function extractReply(stdout: string): string {
  const lines = stdout.split("\n")
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim()
    if (!line?.startsWith("{")) continue
    try {
      const parsed = JSON.parse(line) as { reply?: unknown }
      if (typeof parsed.reply === "string") return parsed.reply
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
}

function skillForFile(filename: string): CoworkSkillId {
  return path.extname(filename).toLowerCase() === ".csv" ? "csv-export" : "excel-report"
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
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
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
    ...(newArtifacts[0] ? { skillInvoked: newArtifacts[0].skill } : {}),
  }
  await appendMessage(session, message)

  return { message, artifacts: newArtifacts }
}
