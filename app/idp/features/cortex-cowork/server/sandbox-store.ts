import { COWORK_DATA_DIR } from "@/lib/cortex-governance/store"
import type { CoworkProjectConfig } from "@cortex/types"
import { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
import { randomUUID } from "node:crypto"
import type { Dirent } from "node:fs"
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  ChatMessage,
  CoworkArtifact,
  CoworkInputFile,
  CoworkSession,
  CoworkSessionSummary,
  CoworkSessionUsage,
  CoworkSkillSummary,
} from "../types"
import type { ResolvedSkill } from "./skills-catalog"

export interface SandboxSession {
  id: string
  projectId: string
  createdAt: string
  sandboxDir: string
  skillsDir: string
  artifactsDir: string
  inputDir: string
  skills: CoworkSkillSummary[]
  messages: ChatMessage[]
  artifacts: CoworkArtifact[]
  usage: CoworkSessionUsage
}

// What's actually persisted to disk - the *Dir paths are re-derived from the
// session id on every read instead (see sandboxPaths), so a stale absolute
// path never leaks in if the data dir moves between processes.
interface SessionMeta {
  id: string
  projectId: string
  createdAt: string
  skills: CoworkSkillSummary[]
  messages: ChatMessage[]
  artifacts: CoworkArtifact[]
  usage?: CoworkSessionUsage
}

const SESSIONS_DIR = path.join(COWORK_DATA_DIR, "sessions")

function emptyUsage(contextWindow: number): CoworkSessionUsage {
  return { lastContextTokens: 0, contextWindow, totalTokens: 0 }
}

// Sessions are persisted as a JSON file inside the session's own sandbox
// directory rather than kept in a module-level Map. Next.js dev (Turbopack)
// does not reliably share module-level state across separate `route.ts`
// compilation units - a plain in-memory singleton here intermittently
// produced "session not found" from a sibling route. The sandbox directory
// is real disk, addressable purely from `sessionId`, so it doubles as the
// session store. Sessions live flat under <dataDir>/sessions/ (projectId is
// session metadata, not a path segment) so every `[sessionId]` route keeps
// resolving without knowing the project.
// Known gap: no file locking, so two concurrent writes to the same session
// can race (last write wins) - fine for a single-user demo, not for prod.
function sandboxPaths(sessionId: string) {
  const sandboxDir = path.join(SESSIONS_DIR, sessionId)
  return {
    sandboxDir,
    skillsDir: path.join(sandboxDir, "skills"),
    artifactsDir: path.join(sandboxDir, "artifacts"),
    inputDir: path.join(sandboxDir, "input"),
    metaPath: path.join(sandboxDir, "session.json"),
  }
}

/**
 * Creates a sandboxed session for a project, copying the skills the project's
 * composition grants (each from its own source folder) into the sandbox. The
 * runner loads skills from the sandbox copy, so this copy IS the governance
 * boundary - a skill that is not copied does not exist for the agent.
 * `contextWindow` seeds the session's context meter from the project's model.
 */
export async function createSandboxSession(
  project: CoworkProjectConfig,
  grantedSkills: ResolvedSkill[],
  contextWindow: number,
): Promise<SandboxSession> {
  const id = randomUUID()
  const { sandboxDir, skillsDir, artifactsDir, inputDir, metaPath } = sandboxPaths(id)

  await mkdir(skillsDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })
  await mkdir(inputDir, { recursive: true })

  // A failed cp rejects the whole create, so `grantedSkills` is exactly what
  // landed in the sandbox. Copy each from its own source folder (skills can
  // come from different departmental sources).
  await Promise.all(
    grantedSkills.map((skill) =>
      cp(path.join(skill.sourceFolder, skill.dirName), path.join(skillsDir, skill.dirName), {
        recursive: true,
      }),
    ),
  )
  const skills: CoworkSkillSummary[] = grantedSkills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
  }))

  // No canned welcome message: a fresh session starts with an empty
  // transcript so the chat's hero (project name + brief cards) can render.
  const session: SandboxSession = {
    id,
    projectId: project.id,
    createdAt: new Date().toISOString(),
    sandboxDir,
    skillsDir,
    artifactsDir,
    inputDir,
    skills,
    messages: [],
    artifacts: [],
    usage: emptyUsage(contextWindow),
  }
  await writeMeta(metaPath, session)
  return session
}

export async function getSandboxSession(sessionId: string): Promise<SandboxSession | undefined> {
  const { sandboxDir, skillsDir, artifactsDir, inputDir, metaPath } = sandboxPaths(sessionId)
  const raw = await readFile(metaPath, "utf8").catch(() => null)
  if (!raw) return undefined
  const meta = JSON.parse(raw) as SessionMeta
  return {
    ...meta,
    // Sessions written before governance landed have no projectId on disk.
    projectId: meta.projectId ?? DEFAULT_COWORK_PROJECT_ID,
    // Sessions written before the context meter existed have no usage.
    usage: meta.usage ?? emptyUsage(0),
    sandboxDir,
    skillsDir,
    artifactsDir,
    inputDir,
  }
}

/** Session summaries for a project's session list, newest first. */
export async function listSessionSummaries(projectId: string): Promise<CoworkSessionSummary[]> {
  const entries = await readdir(SESSIONS_DIR, { withFileTypes: true }).catch(() => [] as Dirent[])
  const summaries: CoworkSessionSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(SESSIONS_DIR, entry.name, "session.json")
    const raw = await readFile(metaPath, "utf8").catch(() => null)
    if (!raw) continue
    const meta = JSON.parse(raw) as SessionMeta
    if ((meta.projectId ?? DEFAULT_COWORK_PROJECT_ID) !== projectId) continue
    const lastMessage = meta.messages.at(-1)
    summaries.push({
      id: meta.id,
      projectId: meta.projectId ?? DEFAULT_COWORK_PROJECT_ID,
      createdAt: meta.createdAt,
      updatedAt: lastMessage?.createdAt ?? meta.createdAt,
      messageCount: meta.messages.filter((message) => message.role === "user").length,
      artifactCount: meta.artifacts.length,
      usage: meta.usage ?? emptyUsage(0),
    })
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Deletes a session and its whole sandbox directory (skills, artifacts, meta). */
export async function deleteSandboxSession(sessionId: string): Promise<boolean> {
  const { sandboxDir, metaPath } = sandboxPaths(sessionId)
  const exists = await stat(metaPath).then(
    () => true,
    () => false,
  )
  if (!exists) return false
  await rm(sandboxDir, { recursive: true, force: true })
  return true
}

/**
 * Records a turn's token usage onto the session (context meter + running
 * total). Context occupancy = everything sent to the model this turn
 * (prompt + cached), i.e. total minus the generated output - this is robust
 * to how the provider splits fresh vs cached input tokens.
 */
export async function recordUsage(
  session: SandboxSession,
  usage: { input: number; output: number; totalTokens: number },
): Promise<void> {
  session.usage = {
    lastContextTokens: Math.max(0, usage.totalTokens - usage.output),
    contextWindow: session.usage.contextWindow,
    totalTokens: session.usage.totalTokens + usage.totalTokens,
  }
  await saveSandboxSession(session)
}

export async function saveSandboxSession(session: SandboxSession): Promise<void> {
  await writeMeta(sandboxPaths(session.id).metaPath, session)
}

function writeMeta(metaPath: string, session: SandboxSession): Promise<void> {
  const meta: SessionMeta = {
    id: session.id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    skills: session.skills,
    messages: session.messages,
    artifacts: session.artifacts,
    usage: session.usage,
  }
  return writeFile(metaPath, JSON.stringify(meta), "utf8")
}

/**
 * User-provided files staged in the session's input/ directory, oldest first.
 * Derived from disk on demand (the directory is the source of truth), so
 * uploads need no session-meta migration.
 */
export async function listInputFiles(session: SandboxSession): Promise<CoworkInputFile[]> {
  const entries = await readdir(session.inputDir, { withFileTypes: true }).catch(
    () => [] as Dirent[],
  )
  const stats = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry): Promise<CoworkInputFile | null> => {
        const info = await stat(path.join(session.inputDir, entry.name)).catch(() => null)
        return info
          ? { filename: entry.name, sizeBytes: info.size, uploadedAt: info.mtime.toISOString() }
          : null
      }),
  )
  return stats
    .filter((file): file is CoworkInputFile => file !== null)
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
}

export function toCoworkSession(
  session: SandboxSession,
  inputFiles: CoworkInputFile[] = [],
): CoworkSession {
  return {
    id: session.id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    skills: session.skills,
    messages: session.messages,
    artifacts: session.artifacts,
    usage: session.usage,
    inputFiles,
  }
}

export async function appendMessage(session: SandboxSession, message: ChatMessage): Promise<void> {
  session.messages.push(message)
  await saveSandboxSession(session)
}

export async function recordUserMessage(
  session: SandboxSession,
  content: string,
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  }
  await appendMessage(session, message)
  return message
}

export async function registerArtifact(
  session: SandboxSession,
  artifact: CoworkArtifact,
): Promise<void> {
  session.artifacts.push(artifact)
  await saveSandboxSession(session)
}

export function findArtifact(
  session: SandboxSession,
  artifactId: string,
): CoworkArtifact | undefined {
  return session.artifacts.find((artifact) => artifact.id === artifactId)
}

export function artifactFilePath(session: SandboxSession, artifact: CoworkArtifact): string {
  return path.join(session.artifactsDir, artifact.filename)
}
