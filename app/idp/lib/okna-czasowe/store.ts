// Local JSON-file persistence for the "Okna czasowe" tile. There is no backend for this
// tile yet — every read/write goes through this module so it can be swapped for a real
// database later without touching the API routes that call it.
import { promises as fs } from "node:fs"
import path from "node:path"
import type { Film, LogEntry, Snapshot } from "@/features/okna-czasowe/types"
import { resolveAppDataDir } from "@/lib/data-dir"

// Was a local copy of the same cwd-detection heuristic cortex-governance/store.ts
// uses - consolidated onto the shared, fixed appIdpDir() (see data-dir.ts for why
// the naive check broke on this app's own "idp" route segment) plus the same
// env-override escape hatch, so both stores are unambiguous in deployment.
const DATA_DIR = process.env.OKNA_CZASOWE_DATA_DIR ?? resolveAppDataDir("okna-czasowe")
const FILMS_FILE = path.join(DATA_DIR, "films.json")
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json")
const LOG_FILE = path.join(DATA_DIR, "log.json")

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  )
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(file, "utf-8")
    return JSON.parse(text) as T
  } catch (error) {
    if (isNotFoundError(error)) return fallback
    throw error
  }
}

async function writeJsonFile<T>(file: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8")
}

export const store = {
  async listFilms(): Promise<Film[]> {
    return readJsonFile<Film[]>(FILMS_FILE, [])
  },
  async saveFilms(films: Film[]): Promise<void> {
    await writeJsonFile(FILMS_FILE, films)
  },
  async listSnapshots(): Promise<Snapshot[]> {
    return readJsonFile<Snapshot[]>(SNAPSHOTS_FILE, [])
  },
  async appendSnapshots(newSnapshots: Snapshot[]): Promise<void> {
    const existing = await readJsonFile<Snapshot[]>(SNAPSHOTS_FILE, [])
    await writeJsonFile(SNAPSHOTS_FILE, [...existing, ...newSnapshots])
  },
  async listLog(): Promise<LogEntry[]> {
    return readJsonFile<LogEntry[]>(LOG_FILE, [])
  },
  async appendLog(entry: LogEntry): Promise<void> {
    const existing = await readJsonFile<LogEntry[]>(LOG_FILE, [])
    await writeJsonFile(LOG_FILE, [...existing, entry])
  },
}
