import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineAgent, defineSkill, defineWorkflow, type SkillReference } from "@flue/runtime"
import { local } from "@flue/runtime/node"
import * as v from "valibot"
// Side-effect import: registers the observe() subscriber that streams live
// agent activity (thinking / tool calls / text progress) to stderr as NDJSON.
import "../observe-events.ts"

// One chat turn of the Cortex Cowork agent, run through the real Flue harness:
// the model works in a local() sandbox with the tile's skills registered, and
// writes any files it produces under <sandboxDir>/artifacts/ - the same
// directory the tile's Artifacts panel serves downloads from.
//
// Invoked by the Next.js app as `flue run cowork-turn --input '{...}'`
// (see app/idp/features/cortex-cowork/server/chat-engine.ts).

// The tile's canonical SKILL.md packages, registered programmatically.
// Equivalent to Flue's `import ... with { type: "skill" }` attribute, but
// sourced at runtime so the runner and the tile share one set of files.
const SKILLS_DIR =
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

function loadSkill(dirName: string): SkillReference {
  const raw = readFileSync(path.join(SKILLS_DIR, dirName, "SKILL.md"), "utf8")
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!fm) throw new Error(`Bad SKILL.md frontmatter: ${dirName}`)
  const block = fm[1] ?? ""
  const body = fm[2] ?? ""
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description) throw new Error(`SKILL.md missing name/description: ${dirName}`)
  return defineSkill({ name, description, instructions: body })
}

const excelReport = loadSkill("excel-report")
const csvExport = loadSkill("csv-export")

const agent = defineAgent(() => ({
  model: process.env.COWORK_MODEL ?? "anthropic/claude-sonnet-4-5",
  instructions:
    "You are Cortex Cowork, an assistant that works inside a sandboxed workspace on " +
    "behalf of a Cortex360 user. Use your skills to turn requests into concrete files " +
    "under the artifacts/ directory of the workspace rather than just describing what " +
    "you would do. Keep replies short and never include absolute host paths in them - " +
    "refer to produced files by filename only.",
  skills: [excelReport, csvExport],
  sandbox: local(),
}))

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
