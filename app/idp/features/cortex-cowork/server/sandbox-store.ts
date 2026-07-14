import { randomUUID } from "node:crypto"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CoworkProjectConfig } from "@cortex/types"
import type { ChatMessage, CoworkArtifact, CoworkSession, CoworkSkillSummary } from "../types"
import { COWORK_DATA_DIR } from "./config-store"
import { SKILLS_SOURCE_DIR, listSkillCatalog } from "./skills-catalog"

export interface SandboxSession {
  id: string
  projectId: string
  createdAt: string
  sandboxDir: string
  skillsDir: string
  artifactsDir: string
  skills: CoworkSkillSummary[]
  messages: ChatMessage[]
  artifacts: CoworkArtifact[]
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
  const sandboxDir = path.join(COWORK_DATA_DIR, "sessions", sessionId)
  return {
    sandboxDir,
    skillsDir: path.join(sandboxDir, "skills"),
    artifactsDir: path.join(sandboxDir, "artifacts"),
    metaPath: path.join(sandboxDir, "session.json"),
  }
}

/**
 * Creates a sandboxed session for a project, copying only the skills the
 * requesting user is entitled to (`skillIds`) into the sandbox. The runner
 * later loads skills from the sandbox copy, so this filter IS the governance
 * boundary - a skill that is not copied does not exist for the agent.
 */
export async function createSandboxSession(
  project: CoworkProjectConfig,
  skillIds: string[],
): Promise<SandboxSession> {
  const id = randomUUID()
  const { sandboxDir, skillsDir, artifactsDir, metaPath } = sandboxPaths(id)

  await mkdir(skillsDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })

  const available = await listSkillCatalog(SKILLS_SOURCE_DIR)
  const wanted = new Set(skillIds)
  for (const skill of available) {
    if (!wanted.has(skill.id)) continue
    await cp(path.join(SKILLS_SOURCE_DIR, skill.id), path.join(skillsDir, skill.id), {
      recursive: true,
    })
  }

  // Read the catalog back from the COPY, not the source, so the welcome
  // message reflects what actually landed in this session's sandbox.
  const skills = await listSkillCatalog(skillsDir)
  const welcome: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: buildWelcomeMessage(project, skills),
    createdAt: new Date().toISOString(),
  }

  const session: SandboxSession = {
    id,
    projectId: project.id,
    createdAt: new Date().toISOString(),
    sandboxDir,
    skillsDir,
    artifactsDir,
    skills,
    messages: [welcome],
    artifacts: [],
  }
  await writeMeta(metaPath, session)
  return session
}

export async function getSandboxSession(sessionId: string): Promise<SandboxSession | undefined> {
  const { sandboxDir, skillsDir, artifactsDir, metaPath } = sandboxPaths(sessionId)
  const raw = await readFile(metaPath, "utf8").catch(() => null)
  if (!raw) return undefined
  const meta = JSON.parse(raw) as SessionMeta
  return {
    ...meta,
    // Sessions written before governance landed have no projectId on disk.
    projectId: meta.projectId ?? "cortex-cowork",
    sandboxDir,
    skillsDir,
    artifactsDir,
  }
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
  }
  return writeFile(metaPath, JSON.stringify(meta), "utf8")
}

export function toCoworkSession(session: SandboxSession): CoworkSession {
  return {
    id: session.id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    skills: session.skills,
    messages: session.messages,
    artifacts: session.artifacts,
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

function buildWelcomeMessage(
  project: CoworkProjectConfig,
  skills: CoworkSkillSummary[],
): string {
  if (skills.length === 0) {
    return [
      `${project.name} is ready, but no skills are enabled for your role yet.`,
      "Ask your administrator to assign you a role with skill groups in Cortex Config.",
    ].join("\n\n")
  }
  const list = skills.map((skill) => `- ${skill.name} - ${skill.description}`).join("\n")
  return [
    `Sandbox ready. Skills available in this session:`,
    list,
    "Tell me what you need and I'll produce downloadable files in this workspace.",
  ].join("\n\n")
}
