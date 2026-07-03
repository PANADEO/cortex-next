import { randomUUID } from "node:crypto"
import type { ChatMessage, CoworkArtifact, CoworkSkillId } from "../types"
import { appendMessage, registerArtifact, type SandboxSession } from "./sandbox-store"
import { generateCsvExport } from "./skills/csv-export"
import { generateExcelReport } from "./skills/excel-report"

/**
 * LIVE agent turn.
 *
 * The chat is driven by a real LLM (Anthropic Messages API with tool use):
 * the model reads the conversation plus the catalog of skills copied into this
 * session's sandbox, and decides on its own whether to answer directly or call
 * a skill tool to produce a downloadable file. Each tool maps to a real
 * file-writing skill under ./skills/*, so the artifacts are genuine.
 *
 * Why not the literal `@flue/runtime` harness (see ../agent/*): Flue loads
 * skills via a `import ... with { type: "skill" }` module attribute and runs
 * the agent in a spawned sandbox subprocess. Neither drops into a Next.js
 * Turbopack API route without a custom loader + out-of-process runner, and the
 * installed @flue/runtime@0.11 API (`createAgent`) differs from the code in
 * ../agent/. Running the model directly here keeps the same agent shape
 * (instructions + skills-as-tools + real files) while staying robust inside
 * the app. The ../agent/ files remain as the documented standalone-Flue target.
 *
 * If ANTHROPIC_API_KEY is unset or the API call fails, we degrade to a
 * deterministic keyword router so the end-to-end chat -> file flow still works.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const MODEL = "claude-sonnet-5"
const MAX_TOKENS = 1024
const MAX_TOOL_STEPS = 4

type SkillRunner = (session: SandboxSession, prompt: string) => Promise<CoworkArtifact>

interface SkillTool {
  skill: CoworkSkillId
  tool: string
  run: SkillRunner
  blurb: string
}

// Every shipped skill, exposed to the model as one callable tool. `run` is the
// real implementation under ./skills/*; adding a skill here + a SKILL.md makes
// it selectable by the agent.
const SKILL_TOOLS: SkillTool[] = [
  {
    skill: "excel-report",
    tool: "generate_excel_report",
    run: generateExcelReport,
    blurb: "Write a downloadable .xlsx workbook into the session sandbox.",
  },
  {
    skill: "csv-export",
    tool: "generate_csv_export",
    run: generateCsvExport,
    blurb: "Write a downloadable .csv file into the session sandbox.",
  },
]

interface AnthropicTextBlock {
  type: "text"
  text: string
}
interface AnthropicToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | { type: string; [key: string]: unknown }

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
}

type ToolResultBlock = {
  type: "tool_result"
  tool_use_id: string
  content: string
  is_error?: boolean
}

interface OutboundMessage {
  role: "user" | "assistant"
  content: string | AnthropicContentBlock[] | ToolResultBlock[]
}

function isText(block: AnthropicContentBlock): block is AnthropicTextBlock {
  return block.type === "text"
}
function isToolUse(block: AnthropicContentBlock): block is AnthropicToolUseBlock {
  return block.type === "tool_use"
}

export async function runChatTurn(
  session: SandboxSession,
  userContent: string,
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  const available = SKILL_TOOLS.filter((tool) =>
    session.skills.some((skill) => skill.id === tool.skill),
  )

  if (!apiKey) {
    console.warn("[cortex-cowork] ANTHROPIC_API_KEY not set - using keyword fallback")
    return runKeywordFallback(session, userContent, available)
  }

  try {
    return await runLiveAgentTurn(session, userContent, apiKey, available)
  } catch (error) {
    console.warn(
      "[cortex-cowork] live agent turn failed, falling back:",
      error instanceof Error ? error.message : error,
    )
    return runKeywordFallback(session, userContent, available)
  }
}

async function callAnthropic(body: {
  apiKey: string
  system: string
  messages: OutboundMessage[]
  tools: unknown[]
}): Promise<AnthropicResponse> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": body.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: body.system,
      tools: body.tools,
      messages: body.messages,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 300)}`)
  }
  return (await response.json()) as AnthropicResponse
}

async function runLiveAgentTurn(
  session: SandboxSession,
  userContent: string,
  apiKey: string,
  available: SkillTool[],
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  const system = buildSystemPrompt(session)
  const tools = available.map((tool) => ({
    name: tool.tool,
    description: `${tool.blurb} ${skillDescription(session, tool.skill)}`.trim(),
    input_schema: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          description:
            "Short description of what the generated file should contain or its title.",
        },
      },
      required: [],
    },
  }))

  const messages = toAnthropicMessages(session.messages)
  const newArtifacts: CoworkArtifact[] = []
  let usedSkill: CoworkSkillId | undefined
  let finalText = ""

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const data = await callAnthropic({ apiKey, system, messages, tools })
    const content = data.content ?? []
    const text = content
      .filter(isText)
      .map((block) => block.text)
      .join("\n")
      .trim()
    const toolUses = content.filter(isToolUse)

    if (text) finalText = text
    if (toolUses.length === 0) break

    messages.push({ role: "assistant", content })
    const results: ToolResultBlock[] = []
    for (const call of toolUses) {
      const spec = available.find((tool) => tool.tool === call.name)
      if (!spec) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `Unknown tool: ${call.name}`,
          is_error: true,
        })
        continue
      }
      const focusInput = call.input?.focus
      const focus =
        typeof focusInput === "string" && focusInput.trim() ? focusInput : userContent
      const artifact = await spec.run(session, focus)
      await registerArtifact(session, artifact)
      newArtifacts.push(artifact)
      usedSkill = spec.skill
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: `Wrote ${artifact.filename} (${artifact.sizeBytes} bytes) to the Artifacts panel.`,
      })
    }
    messages.push({ role: "user", content: results })
  }

  if (!finalText) {
    finalText = newArtifacts.length
      ? `Done - ${newArtifacts.map((artifact) => artifact.filename).join(", ")} is ready in the Artifacts panel.`
      : "I work inside this session's sandbox and hand back real files. Ask for an Excel report or a CSV export and I'll generate one you can download."
  }

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: finalText,
    createdAt: new Date().toISOString(),
    ...(usedSkill ? { skillInvoked: usedSkill } : {}),
  }
  await appendMessage(session, message)
  return { message, artifacts: newArtifacts }
}

function buildSystemPrompt(session: SandboxSession): string {
  const skillLines = session.skills
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n")
  return [
    "You are Cortex Cowork, an assistant working inside a sandboxed workspace on behalf of a Cortex360 user.",
    "You have skills available as tools. When the user wants a file, call the matching tool to actually produce it in the sandbox rather than only describing what you would do.",
    "When you just need to answer a question, reply directly and concisely. Keep replies short.",
    "Skills copied into this session:",
    skillLines || "- (none)",
  ].join("\n")
}

function skillDescription(session: SandboxSession, skillId: CoworkSkillId): string {
  return session.skills.find((skill) => skill.id === skillId)?.description ?? ""
}

// Maps stored chat history to Anthropic message turns. Drops the leading
// assistant welcome (the API requires the first message to be from the user);
// every subsequent turn is a user->assistant pair, so alternation holds.
function toAnthropicMessages(messages: ChatMessage[]): OutboundMessage[] {
  const out: OutboundMessage[] = []
  for (const message of messages) {
    if (out.length === 0 && message.role === "assistant") continue
    out.push({ role: message.role, content: message.content })
  }
  return out
}

/**
 * Deterministic degrade path: keyword routing over the real skills, used when
 * no API key is configured or the live model call fails. The file-writing
 * skills it calls are the same real implementations under ./skills/*.
 */
async function runKeywordFallback(
  session: SandboxSession,
  userContent: string,
  available: SkillTool[],
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  const has = (skill: CoworkSkillId) => available.some((tool) => tool.skill === skill)
  const wantsCsv = /\bcsv\b/i.test(userContent) && has("csv-export")
  const wantsExcel =
    !wantsCsv &&
    /excel|xlsx|arkusz|spreadsheet|raport|report/i.test(userContent) &&
    has("excel-report")

  const newArtifacts: CoworkArtifact[] = []
  let replyLines: string[]

  if (wantsExcel) {
    const artifact = await generateExcelReport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "Loaded the excel-report skill and generated a workbook in the sandbox.",
      `Ready: ${artifact.filename} - grab it from the Artifacts panel.`,
    ]
  } else if (wantsCsv) {
    const artifact = await generateCsvExport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "Loaded the csv-export skill and wrote a CSV in the sandbox.",
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
