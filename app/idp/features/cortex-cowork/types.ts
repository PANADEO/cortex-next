export type ChatRole = "user" | "assistant"

// Skills are data, not code: the catalog is whatever SKILL.md packages exist
// in the skills source directory, and customer installs add their own without
// a deploy - so skill ids are open strings, not a compile-time union.
export type CoworkSkillId = string

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
  /** Set when the Flue runner failed and this reply came from keyword fallback. */
  degraded?: boolean
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

/** Token accounting for a session's context-window meter and cumulative spend. */
export interface CoworkSessionUsage {
  /** Input tokens sent on the most recent turn = current context occupancy. */
  lastContextTokens: number
  /** Model context window (tokens) the occupancy is measured against. */
  contextWindow: number
  /** Cumulative tokens across all turns (running total). */
  totalTokens: number
}

export interface CoworkSession {
  id: string
  projectId: string
  createdAt: string
  skills: CoworkSkillSummary[]
  messages: ChatMessage[]
  artifacts: CoworkArtifact[]
  usage: CoworkSessionUsage
}

/** Lightweight session descriptor for the session list (no messages/artifacts). */
export interface CoworkSessionSummary {
  id: string
  projectId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  artifactCount: number
  usage: CoworkSessionUsage
}

export interface SendMessageRequest {
  content: string
}

export interface SendMessageResponse {
  message: ChatMessage
  artifacts: CoworkArtifact[]
  usage: CoworkSessionUsage
}
