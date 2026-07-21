import path from "node:path"
import type { CoworkResourceGrant } from "@cortex/types"
import { secretPathGranted } from "@cortex/types"
import { readJsonOr, writeJsonAtomic } from "./json-file"
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

export interface CredentialsDocument {
  version: 1
  /** "key/subkey" -> secret value */
  values: Record<string, string>
}

export function isValidCredentialPath(credentialPath: string): boolean {
  return CREDENTIAL_PATH_PATTERN.test(credentialPath)
}

/**
 * Loads the full document. Callers that resolve several refs in one request
 * (chat-engine: model key + every connector) read once and pass the document
 * to the resolve helpers instead of re-reading per ref.
 */
export function readCredentialsDocument(): Promise<CredentialsDocument> {
  return readJsonOr<CredentialsDocument>(CREDENTIALS_FILE, () => ({ version: 1, values: {} }))
}

function writeDocument(doc: CredentialsDocument): Promise<void> {
  return writeJsonAtomic(CREDENTIALS_FILE, doc, { mode: 0o600 })
}

/** Paths only - values never leave the server through this function. */
export async function listCredentialPaths(): Promise<string[]> {
  const doc = await readCredentialsDocument()
  return Object.keys(doc.values).sort()
}

export async function setCredential(credentialPath: string, value: string): Promise<void> {
  const doc = await readCredentialsDocument()
  doc.values[credentialPath] = value
  await writeDocument(doc)
}

export async function deleteCredential(credentialPath: string): Promise<boolean> {
  const doc = await readCredentialsDocument()
  if (!(credentialPath in doc.values)) return false
  delete doc.values[credentialPath]
  await writeDocument(doc)
  return true
}

/**
 * Restricts a credentials document to the paths a project's secret grant
 * allows. Everything a project resolves (model key, connector refs) goes
 * through the gated document, so a project can never reference secrets from a
 * department it wasn't granted - the data-zone boundary is technical.
 */
export function gateCredentials(
  doc: CredentialsDocument,
  grant: CoworkResourceGrant,
): CredentialsDocument {
  const values: Record<string, string> = {}
  for (const [credentialPath, value] of Object.entries(doc.values)) {
    if (secretPathGranted(grant, credentialPath)) values[credentialPath] = value
  }
  return { version: 1, values }
}

/** Resolves one ref against a preloaded document. Returns undefined when unset. */
export function resolveCredential(
  doc: CredentialsDocument,
  credentialPath: string | undefined,
): string | undefined {
  if (!credentialPath) return undefined
  return doc.values[credentialPath]
}

/** Resolves a ref map ({ header/env name -> credential path }) to values. */
export function resolveCredentialRefs(
  doc: CredentialsDocument,
  refs: Record<string, string> | undefined,
): Record<string, string> {
  if (!refs) return {}
  const resolved: Record<string, string> = {}
  for (const [name, credentialPath] of Object.entries(refs)) {
    const value = doc.values[credentialPath]
    if (value !== undefined) resolved[name] = value
  }
  return resolved
}
