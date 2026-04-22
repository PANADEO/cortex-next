export type IntakeKind = "zip" | "loose"

export function detectIntakeKind(files: readonly File[]): IntakeKind {
  return files.length === 1 && /\.zip$/i.test(files[0]!.name) ? "zip" : "loose"
}

interface FileSystemFileEntryLike extends FileSystemEntry {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (err: unknown) => void,
  ) => void
}

interface FileSystemDirectoryEntryLike extends FileSystemEntry {
  createReader: () => {
    readEntries: (
      successCallback: (entries: FileSystemEntry[]) => void,
      errorCallback?: (err: unknown) => void,
    ) => void
  }
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntryLike {
  return entry.isFile
}

function isDirectoryEntry(
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntryLike {
  return entry.isDirectory
}

async function readFile(entry: FileSystemFileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

async function readAll(
  reader: ReturnType<FileSystemDirectoryEntryLike["createReader"]>,
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  const readBatch = () =>
    new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
  // readEntries zwraca partiami po ~100 — trzeba pętlić do pustego wyniku.
  for (;;) {
    const batch = await readBatch()
    if (batch.length === 0) break
    all.push(...batch)
  }
  return all
}

async function traverse(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (isFileEntry(entry)) {
    try {
      out.push(await readFile(entry))
    } catch {
      /* ignore unreadable entries */
    }
  } else if (isDirectoryEntry(entry)) {
    const entries = await readAll(entry.createReader())
    await Promise.all(entries.map((e) => traverse(e, out)))
  }
}

/**
 * Wyciąga wszystkie pliki z drop eventu — łącznie z zawartością upuszczonych
 * folderów. Fallback na `dataTransfer.files` gdy browser nie wspiera entries API.
 */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? [])
  const result: File[] = []

  if (items.length > 0) {
    const entries = items
      .filter((item) => item.kind === "file")
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null)

    if (entries.length > 0) {
      await Promise.all(entries.map((e) => traverse(e, result)))
      if (result.length > 0) return result
    }
  }

  return Array.from(dt.files ?? [])
}
