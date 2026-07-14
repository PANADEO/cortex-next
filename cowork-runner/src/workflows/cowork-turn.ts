import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineAgent, defineSkill, defineWorkflow, type SkillReference } from "@flue/runtime"
import { local } from "@flue/runtime/node"
import * as v from "valibot"
import { configureModel, readModelConfigFromEnv } from "../model-provider.ts"
// Side-effect import: registers the observe() subscriber that streams live
// agent activity (thinking / tool calls / text progress) to stderr as NDJSON.
import "../observe-events.ts"

// One chat turn of a Cortex Cowork project agent, run through the real Flue
// harness: the model works in a local() sandbox with the session's skills
// registered, and writes any files it produces under <sandboxDir>/artifacts/ -
// the same directory the tile's Artifacts panel serves downloads from.
//
// Invoked by the Next.js app as `flue run cowork-turn --input '{...}'`
// (see app/idp/features/cortex-cowork/server/chat-engine.ts). Per-instance
// configuration arrives via env, not --input: COWORK_SANDBOX_DIR (which
// session sandbox to load skills from), COWORK_MODEL_CONFIG (provider/model,
// carries the resolved API key - env so it never shows up in `ps`), and
// COWORK_SYSTEM_PROMPT (project-specific instructions).

// Fallback skills source for standalone runs (`flue run` without the app):
// the tile's canonical SKILL.md packages inside the repo.
const FALLBACK_SKILLS_DIR =
  process.env.COWORK_SKILLS_DIR ??
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
  const sandboxDir = process.env.COWORK_SANDBOX_DIR
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

const agent = defineAgent(() => {
  const systemPrompt = process.env.COWORK_SYSTEM_PROMPT
  const sandboxDir = process.env.COWORK_SANDBOX_DIR
  return {
    model: configureModel(readModelConfigFromEnv()),
    instructions: systemPrompt ? `${BASE_INSTRUCTIONS}\n\n${systemPrompt}` : BASE_INSTRUCTIONS,
    skills: loadSessionSkills(),
    sandbox: local(),
    ...(sandboxDir ? { cwd: sandboxDir } : {}),
  }
})

export default defineWorkflow({
  agent,
  input: v.object({
    message: v.string(),
    sandboxDir: v.string(),
    history: v.optional(v.string()),
  }),
  output: v.object({ reply: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session()
    const prompt = [
      `Workspace for this session: ${input.sandboxDir}`,
      `Write any files you produce under: ${input.sandboxDir}/artifacts/`,
      input.history ? `Conversation so far:\n${input.history}` : "",
      `User message: ${input.message}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    const response = await session.prompt(prompt)
    // session.prompt resolves to a PromptResponse ({ text, usage, model }).
    const reply =
      typeof response === "string"
        ? response
        : ((response as { text?: string }).text ?? JSON.stringify(response))
    return { reply }
  },
})
