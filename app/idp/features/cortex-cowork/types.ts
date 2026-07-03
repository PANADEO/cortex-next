export type ChatRole = "user" | "assistant"

// Loaded dynamically from each skill's SKILL.md at runtime (see
// server/skill-frontmatter.ts), so this union can't be exhaustively narrowed
// from disk content - the id is cast at the parse boundary.
export type CoworkSkillId = "excel-report" | "csv-export"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  skillInvoked?: CoworkSkillId
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
