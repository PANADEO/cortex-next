import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  defineAgent,
  defineSkill,
  defineWorkflow,
  type SandboxFactory,
  type SkillReference,
} from "@flue/runtime"
import { local } from "@flue/runtime/node"
import * as v from "valibot"
import { buildConnectorTools, readConnectorsFromEnv } from "../connectors.ts"
import { dockerSandbox } from "../docker-sandbox.ts"
import { ENV, readJsonEnv } from "../env.ts"
import { configureModel, readModelConfigFromEnv } from "../model-provider.ts"
// Side-effect import: registers the observe() subscriber that streams live
// agent activity (thinking / tool calls / text progress) to stderr as NDJSON.
import "../observe-events.ts"

// One chat turn of a Cortex Cowork project agent, run through the real Flue
// harness: the model works in a sandbox with the session's skills registered,
// and writes any files it produces under <workspace>/artifacts/ - the same
// directory the tile's Artifacts panel serves downloads from.
//
// Invoked by the Next.js app as `flue run cowork-turn --input '{...}'`
// (see app/idp/features/cortex-cowork/server/chat-engine.ts). Per-instance
// configuration arrives via env, not --input (see ../env.ts for the full
// contract) - notably the model config carries the resolved API key, and env
// never shows up in `ps`.

// Fallback skills source for standalone runs (`flue run` without the app):
// the tile's canonical SKILL.md packages inside the repo.
const FALLBACK_SKILLS_DIR =
  process.env[ENV.skillsDir] ??
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "app",
    "idp",
    "features",
    "cortex-cowork",
    "skills",
  )

function loadSkill(skillsDir: string, dirName: string): SkillReference {
  const raw = readFileSync(path.join(skillsDir, dirName, "SKILL.md"), "utf8")
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!fm) throw new Error(`Bad SKILL.md frontmatter: ${dirName}`)
  const block = fm[1] ?? ""
  const body = fm[2] ?? ""
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description) throw new Error(`SKILL.md missing name/description: ${dirName}`)
  return defineSkill({ name, description, instructions: body })
}

/**
 * Loads every SKILL.md package found in the session sandbox's skills/
 * directory. The app copies in only the skills the user's role entitles them
 * to, so this directory listing IS the effective permission set - the runner
 * never reaches back to the global catalog when a sandbox is specified.
 */
function loadSessionSkills(): SkillReference[] {
  const sandboxDir = process.env[ENV.sandboxDir]
  const skillsDir = sandboxDir ? path.join(sandboxDir, "skills") : FALLBACK_SKILLS_DIR
  let entries: string[]
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
  const skills: SkillReference[] = []
  for (const dirName of entries) {
    try {
      skills.push(loadSkill(skillsDir, dirName))
    } catch (error) {
      console.error(
        `[cowork-runner] skipping unloadable skill "${dirName}":`,
        error instanceof Error ? error.message : error,
      )
    }
  }
  return skills
}

const BASE_INSTRUCTIONS =
  "You are Cortex Cowork, an assistant that works inside a sandboxed workspace on " +
  "behalf of a Cortex360 user. Use your skills to turn requests into concrete files " +
  "under the artifacts/ directory of the workspace rather than just describing what " +
  "you would do. Keep replies short and never include absolute host paths in them - " +
  "refer to produced files by filename only."

/**
 * The agent's view of the workspace - the ONE place that maps sandbox mode to
 * the path the model sees. In docker mode the session sandbox dir mounts at
 * /workspace, so every path in prompts and cwd must be the container path; on
 * the host they are the same directory (bind mount). `fallbackDir` covers
 * standalone runs where only --input carries the sandbox dir.
 */
function workspacePath(fallbackDir?: string): string {
  if (process.env[ENV.sandboxMode] === "docker") return "/workspace"
  return process.env[ENV.sandboxDir] ?? fallbackDir ?? process.cwd()
}

function readAllowedPaths(): string[] {
  const parsed = readJsonEnv<unknown>(ENV.sandboxPaths, [])
  return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : []
}

/**
 * Sandbox selection is part of governance: a project configured for docker
 * MUST NOT fall back to host execution - if Docker is missing the turn fails
 * loudly and the app surfaces the error.
 */
function selectSandbox(): SandboxFactory {
  const sandboxDir = process.env[ENV.sandboxDir]
  if (process.env[ENV.sandboxMode] === "docker" && sandboxDir) {
    const image = process.env[ENV.sandboxImage]
    return dockerSandbox({
      sandboxDir,
      allowedPaths: readAllowedPaths(),
      ...(image ? { image } : {}),
    })
  }
  return local()
}

const agent = defineAgent(async () => {
  const systemPrompt = process.env[ENV.systemPrompt]
  return {
    model: configureModel(readModelConfigFromEnv()),
    instructions: systemPrompt ? `${BASE_INSTRUCTIONS}\n\n${systemPrompt}` : BASE_INSTRUCTIONS,
    skills: loadSessionSkills(),
    tools: await buildConnectorTools(readConnectorsFromEnv()),
    sandbox: selectSandbox(),
    cwd: workspacePath(),
  }
})

export default defineWorkflow({
  agent,
  input: v.object({
    message: v.string(),
    sandboxDir: v.string(),
    history: v.optional(v.string()),
  }),
  // `usage` lets the app track context-window occupancy (input tokens = what
  // was sent this turn) and cumulative spend. Optional so a string response
  // (older Flue / degraded) still validates.
  output: v.object({
    reply: v.string(),
    usage: v.optional(
      v.object({
        input: v.number(),
        output: v.number(),
        totalTokens: v.number(),
      }),
    ),
  }),
  async run({ harness, input }) {
    const session = await harness.session()
    const workspace = workspacePath(input.sandboxDir)
    const allowedPaths = readAllowedPaths()
    // input/ holds files the user uploaded/pasted for this task. Listed via
    // the HOST path (the runner process runs on the host either way); the
    // prompt cites the workspace path the agent's sandbox actually sees.
    const hostSandboxDir = process.env[ENV.sandboxDir] ?? input.sandboxDir
    let inputFiles: string[] = []
    try {
      inputFiles = readdirSync(path.join(hostSandboxDir, "input"), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
    } catch {
      // no input directory - nothing staged for this session
    }
    const prompt = [
      `Workspace for this session: ${workspace}`,
      `Write any files you produce under: ${workspace}/artifacts/`,
      inputFiles.length > 0
        ? `Files the user provided for this task (read them from ${workspace}/input/): ${inputFiles.join(", ")}`
        : "",
      allowedPaths.length > 0
        ? `Additional data paths available to you: ${allowedPaths.join(", ")}`
        : "",
      input.history ? `Conversation so far:\n${input.history}` : "",
      `User message: ${input.message}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    const response = await session.prompt(prompt)
    // session.prompt resolves to a PromptResponse ({ text, usage, model }).
    if (typeof response === "string") return { reply: response }
    const typed = response as {
      text?: string
      usage?: { input: number; output: number; totalTokens: number }
    }
    return {
      reply: typed.text ?? JSON.stringify(response),
      ...(typed.usage
        ? {
            usage: {
              input: typed.usage.input,
              output: typed.usage.output,
              totalTokens: typed.usage.totalTokens,
            },
          }
        : {}),
    }
  },
})
