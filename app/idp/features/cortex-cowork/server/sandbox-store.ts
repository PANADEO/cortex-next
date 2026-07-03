import { randomUUID } from "node:crypto"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ChatMessage, CoworkArtifact, CoworkSession, CoworkSkillSummary } from "../types"
import { SKILLS_SOURCE_DIR, listSkillCatalog } from "./skills-catalog"

export interface SandboxSession {
  id: string
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
// path never leaks in if os.tmpdir() ever changes between processes.
interface SessionMeta {
  id: string
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
// session store. This also matches Flue's remote-sandbox guidance closer:
// "your application is responsible for deciding when it is deleted or
// expired" implies sandbox state that outlives any single process anyway.
// Known gap: no file locking, so two concurrent writes to the same session
// can race (last write wins) - fine for a single-user demo, not for prod.
function sandboxPaths(sessionId: string) {
  const sandboxDir = path.join(os.tmpdir(), "cortex-cowork", sessionId)
  return {
    sandboxDir,
    skillsDir: path.join(sandboxDir, "skills"),
    artifactsDir: path.join(sandboxDir, "artifacts"),
    metaPath: path.join(sandboxDir, "session.json"),
  }
}

export async function createSandboxSession(): Promise<SandboxSession> {
  const id = randomUUID()
  const { sandboxDir, skillsDir, artifactsDir, metaPath } = sandboxPaths(id)

  await mkdir(sandboxDir, { recursive: true })
  await cp(SKILLS_SOURCE_DIR, skillsDir, { recursive: true })
  await mkdir(artifactsDir, { recursive: true })

  // Read the catalog back from the COPY, not the source, so the welcome
  // message reflects what actually landed in this session's sandbox.
  const skills = await listSkillCatalog(skillsDir)
  const welcome: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: buildWelcomeMessage(skills),
    createdAt: new Date().toISOString(),
  }

  const session: SandboxSession = {
    id,
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
  return { ...meta, sandboxDir, skillsDir, artifactsDir }
}

export async function saveSandboxSession(session: SandboxSession): Promise<void> {
  await writeMeta(sandboxPaths(session.id).metaPath, session)
}

function writeMeta(metaPath: string, session: SandboxSession): Promise<void> {
  const meta: SessionMeta = {
    id: session.id,
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

function buildWelcomeMessage(skills: CoworkSkillSummary[]): string {
  const list = skills.map((skill) => `- ${skill.name} - ${skill.description}`).join("\n")
  return [
    `Sandbox ready. I copied ${skills.length} skill${skills.length === 1 ? "" : "s"} into this session's workspace:`,
    list,
    "Ask for an excel report or a csv export and I'll generate a downloadable file here.",
  ].join("\n\n")
}
