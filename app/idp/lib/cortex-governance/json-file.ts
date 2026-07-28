import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

// Shared JSON-document persistence for the governance stores (config +
// credentials): ENOENT-tolerant read and atomic write (tmp file + rename) so
// a crash mid-write never leaves a torn document behind.

export async function readJsonOr<T>(file: string, fallback: () => T): Promise<T> {
  try {
    const raw = await readFile(file, "utf8")
    return JSON.parse(raw) as T
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== "ENOENT") throw error
    return fallback()
  }
}

// Per-resolved-path in-memory write queue: writers targeting the same file
// share `${file}.tmp`, so two concurrent writeJsonAtomic() calls could race
// on that tmp path — one rename() finding it already moved away by the
// other (ENOENT), or the tmp content itself getting interleaved. Chaining
// each write behind the previous one for the same path serializes them
// within this process (single-container deployment, no multi-replica
// concern), so every call still resolves/rejects on its own outcome and
// none is silently lost.
const writeQueue = new Map<string, Promise<void>>()

function enqueue(key: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueue.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  const settled = run.then(
    () => undefined,
    () => undefined,
  )
  writeQueue.set(key, settled)
  void settled.finally(() => {
    if (writeQueue.get(key) === settled) writeQueue.delete(key)
  })
  return run
}

export async function writeJsonAtomic(
  file: string,
  data: unknown,
  options: { mode?: number } = {},
): Promise<void> {
  const key = path.resolve(file)
  return enqueue(key, async () => {
    await mkdir(path.dirname(file), { recursive: true })
    const tmpPath = `${file}.tmp`
    await writeFile(tmpPath, JSON.stringify(data, null, 2), {
      encoding: "utf8",
      ...(options.mode !== undefined ? { mode: options.mode } : {}),
    })
    await rename(tmpPath, file)
  })
}
