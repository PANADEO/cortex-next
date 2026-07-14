import path from "node:path"
import { readJsonOr, writeJsonAtomic } from "./json-file"
import { COWORK_DATA_DIR } from "./store"

// The user layer of the hierarchical AGENTS.md: a personal note each user may
// set for themselves ("Moje instrukcje"), composed into the system prompt
// AFTER the admin layers (organization -> department -> tile). Self-service
// data, so it lives outside the admin-gated governance document.

const USER_INSTRUCTIONS_FILE = path.join(COWORK_DATA_DIR, "user-instructions.json")

export const USER_INSTRUCTIONS_MAX_LENGTH = 4000

interface UserInstructionsDocument {
  version: 1
  /** lowercased email -> personal instructions */
  users: Record<string, string>
}

function readDocument(): Promise<UserInstructionsDocument> {
  return readJsonOr<UserInstructionsDocument>(USER_INSTRUCTIONS_FILE, () => ({
    version: 1,
    users: {},
  }))
}

export async function readUserInstructions(email: string): Promise<string | undefined> {
  const doc = await readDocument()
  return doc.users[email.toLowerCase()]
}

/** Saves the user's personal note; an empty/whitespace value removes it. */
export async function setUserInstructions(email: string, value: string): Promise<void> {
  const doc = await readDocument()
  const key = email.toLowerCase()
  const trimmed = value.trim()
  if (trimmed) doc.users[key] = trimmed
  else delete doc.users[key]
  await writeJsonAtomic(USER_INSTRUCTIONS_FILE, doc)
}
