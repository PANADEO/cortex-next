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

export async function writeJsonAtomic(
  file: string,
  data: unknown,
  options: { mode?: number } = {},
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmpPath = `${file}.tmp`
  await writeFile(tmpPath, JSON.stringify(data, null, 2), {
    encoding: "utf8",
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
  })
  await rename(tmpPath, file)
}
