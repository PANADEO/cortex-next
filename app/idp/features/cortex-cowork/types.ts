export type ChatRole = "user" | "assistant"

// Loaded dynamically from each skill's SKILL.md at runtime (see
// server/skill-frontmatter.ts), so this union can't be exhaustively narrowed
// from disk content - the id is cast at the parse boundary.
export type CoworkSkillId = "excel-report" | "csv-export"

// One observed step of the agent's work during a turn (thinking, tool call,
// lifecycle marker), as emitted live by the Flue runner's observe() bridge.
// `detail` carries the drilldown payload: tool arguments for tool_start,
// a result excerpt for tool_end, the full thinking text for thinking.
export type AgentActivityKind =
  | "thinking"
  | "thinking_start"
  | "tool_start"
  | "tool_end"
  | "assistant"
  | "lifecycle"

export interface AgentActivityStep {
  id: string
  ts: string
  kind: AgentActivityKind
  tool?: string
  detail?: string
  text?: string
  isError?: boolean
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  skillInvoked?: CoworkSkillId
  /** Persisted work trail from the live activity stream (drilldown panel). */
  activity?: AgentActivityStep[]
}

export interface CoworkSkillSummary {
  id: CoworkSkillId
  name: string
  description: string
}

export interface CoworkArtifact {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  skill: CoworkSkillId
}

export interface CoworkSession {
  id: string
  createdAt: string
  skills: CoworkSkillSummary[]
  messages: ChatMessage[]
  artifacts: CoworkArtifact[]
}

export interface SendMessageRequest {
  content: string
}

export interface SendMessageResponse {
  message: ChatMessage
  artifacts: CoworkArtifact[]
}
