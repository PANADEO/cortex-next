// Local JSON-file persistence for the "Okna czasowe" tile. There is no backend for this
// tile yet — every read/write goes through this module so it can be swapped for a real
// database later without touching the API routes that call it.
import { existsSync } from "node:fs"
import { promises as fs } from "node:fs"
import path from "node:path"
import type { Film, LogEntry, Snapshot } from "@/features/okna-czasowe/types"

// `npm run dev|build|start` and the Docker image all invoke Next.js as `next <cmd> app/idp`
// from the repo root, so `process.cwd()` is the repo root, not `app/idp` — verified by
// running the dev server, which otherwise writes to `<repo-root>/.data/` instead of
// `app/idp/.data/`. Resolve explicitly through `app/idp` so the store dir stays app-scoped
// regardless of which of those entry points invoked the process.
function resolveDataDir(): string {
  const appIdpRelative = path.join(process.cwd(), "app", "idp")
  const base = existsSync(appIdpRelative) ? appIdpRelative : process.cwd()
  return path.join(base, ".data", "okna-czasowe")
}

const DATA_DIR = resolveDataDir()
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
