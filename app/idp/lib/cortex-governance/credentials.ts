import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { COWORK_DATA_DIR } from "./store"

// Credential store for connectors and model API keys: a flat map of
// "key/subkey" paths to secret values, persisted separately from the
// governance document so the two never travel together. Values are
// server-side only - list endpoints return paths, never values, and the UI
// can only (re)write a secret, not read it back.
//
// At-rest: plaintext JSON with 0600 perms in the app data dir. Named
// limitation for phase 1 (on-prem, single tenant); envelope encryption with
// a key from env is the planned hardening step.

const CREDENTIALS_FILE = path.join(COWORK_DATA_DIR, "credentials.json")
const CREDENTIAL_PATH_PATTERN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)+$/

interface CredentialsDocument {
  version: 1
  /** "key/subkey" -> secret value */
  values: Record<string, string>
}

export function isValidCredentialPath(credentialPath: string): boolean {
  return CREDENTIAL_PATH_PATTERN.test(credentialPath)
}

async function readDocument(): Promise<CredentialsDocument> {
  try {
    const raw = await readFile(CREDENTIALS_FILE, "utf8")
    return JSON.parse(raw) as CredentialsDocument
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== "ENOENT") throw error
    return { version: 1, values: {} }
  }
}

async function writeDocument(doc: CredentialsDocument): Promise<void> {
  await mkdir(COWORK_DATA_DIR, { recursive: true })
  const tmpPath = `${CREDENTIALS_FILE}.tmp`
  await writeFile(tmpPath, JSON.stringify(doc, null, 2), { encoding: "utf8", mode: 0o600 })
  await rename(tmpPath, CREDENTIALS_FILE)
}

/** Paths only - values never leave the server through this function. */
export async function listCredentialPaths(): Promise<string[]> {
  const doc = await readDocument()
  return Object.keys(doc.values).sort()
}

export async function setCredential(credentialPath: string, value: string): Promise<void> {
  const doc = await readDocument()
  doc.values[credentialPath] = value
  await writeDocument(doc)
}

export async function deleteCredential(credentialPath: string): Promise<boolean> {
  const doc = await readDocument()
  if (!(credentialPath in doc.values)) return false
  delete doc.values[credentialPath]
  await writeDocument(doc)
  return true
}

/** Server-side resolution for runner spawns. Returns undefined when unset. */
export async function resolveCredential(
  credentialPath: string | undefined,
): Promise<string | undefined> {
  if (!credentialPath) return undefined
  const doc = await readDocument()
  return doc.values[credentialPath]
}

/** Resolves a ref map ({ header/env name -> credential path }) to values. */
export async function resolveCredentialRefs(
  refs: Record<string, string> | undefined,
): Promise<Record<string, string>> {
  if (!refs) return {}
  const doc = await readDocument()
  const resolved: Record<string, string> = {}
  for (const [name, credentialPath] of Object.entries(refs)) {
    const value = doc.values[credentialPath]
    if (value !== undefined) resolved[name] = value
  }
  return resolved
}
