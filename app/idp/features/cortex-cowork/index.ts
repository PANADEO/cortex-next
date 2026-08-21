export { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
export { ChatPanel } from "./components/chat-panel"
export { CoworkShell } from "./components/cowork-shell"
export { SessionPanels } from "./components/floating-panels"
export { useCoworkArtifacts } from "./hooks/use-artifacts"
export { useCoworkSession, useEnsureCoworkSession } from "./hooks/use-cowork-session"
export { useCoworkSessionActions, useCoworkSessions } from "./hooks/use-cowork-sessions"
export { useUploadInputFiles } from "./hooks/use-input-files"
export { PROJECT_ICON_OPTIONS, useCoworkProjectTiles } from "./hooks/use-project-tiles"
export { useSendCoworkMessage } from "./hooks/use-send-message"
export { useCoworkSkillCatalog } from "./hooks/use-skill-catalog"
export { coworkApi, coworkQueryKeys, type CoworkProjectTile } from "./queries"
export type {
  ChatMessage,
  CoworkArtifact,
  CoworkInputFile,
  CoworkSession,
  CoworkSkillId,
  CoworkSkillSummary,
} from "./types"
