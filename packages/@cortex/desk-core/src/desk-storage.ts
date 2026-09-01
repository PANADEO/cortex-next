import { promises as fs } from "node:fs"
import path from "node:path"
import type { FileMeta } from "./types"

const BASE = path.resolve(process.env.DESK_DATA_DIR ?? "./.data")

/**
 * F2 · BIURKO — warstwa plików, TRWAŁA i oddzielona od sandboxa.
 * W POC katalog na dysku; w produkcji usługa desk-store.
 * Reguła: powłoka nigdy nie sięga do dysku bezpośrednio, wyłącznie tędy.
 */
function safePath(user: string, wzgledna: string) {
  const root = path.join(BASE, "biurka", user)
  const cel = path.resolve(root, wzgledna.replace(/^\/+/, ""))
  if (cel !== root && !cel.startsWith(root + path.sep)) {
    throw new Error("Ścieżka poza biurkiem")
  }
  return { root, cel }
}

export async function prepareDesk(user: string) {
  const { root } = safePath(user, ".")
  await fs.mkdir(path.join(root, "Moje pliki"), { recursive: true })
  await fs.mkdir(path.join(root, "Sprawy"), { recursive: true })
  await fs.mkdir(path.join(root, ".trash"), { recursive: true })
  return root
}

export async function list(user: string, wzgledna = "Moje pliki"): Promise<FileMeta[]> {
  await prepareDesk(user)
  const { root, cel } = safePath(user, wzgledna)
  await fs.mkdir(cel, { recursive: true })
  const entries = await fs.readdir(cel, { withFileTypes: true })
  const out: FileMeta[] = []
  for (const w of entries) {
    if (w.name.startsWith(".")) continue
    const full = path.join(cel, w.name)
    const st = await fs.stat(full)
    out.push({
      path: path.relative(root, full),
      name: w.name,
      folder: w.isDirectory(),
      size: st.size,
      modifiedAt: st.mtime.toISOString(),
    })
  }
  return out.sort(
    (a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name, "pl"),
  )
}

export async function read(user: string, wzgledna: string): Promise<string> {
  const { cel } = safePath(user, wzgledna)
  return fs.readFile(cel, "utf8")
}

export async function readBinary(user: string, wzgledna: string): Promise<Buffer> {
  const { cel } = safePath(user, wzgledna)
  return fs.readFile(cel)
}

export async function write(user: string, wzgledna: string, text: string | Buffer) {
  const { cel } = safePath(user, wzgledna)
  await fs.mkdir(path.dirname(cel), { recursive: true })
  await fs.writeFile(cel, text)
  return wzgledna
}

/** Wgranie nigdy nie nadpisuje tego, co już jest — drugi „faktury.csv" ląduje jako „faktury (2).csv". */
export async function writeNew(user: string, wzgledna: string, text: string | Buffer) {
  const { root, cel } = safePath(user, wzgledna)
  await fs.mkdir(path.dirname(cel), { recursive: true })
  const free = await freeName(cel)
  await fs.writeFile(free, text)
  return path.relative(root, free)
}

export async function createFolder(user: string, wzgledna: string) {
  const { cel } = safePath(user, wzgledna)
  await fs.mkdir(cel, { recursive: true })
}

/** Nazwa, która na pewno nikogo nie nadpisze: „raport.md" → „raport (2).md". */
async function freeName(fullTarget: string): Promise<string> {
  const dir = path.dirname(fullTarget)
  const base = path.basename(fullTarget)
  const dot = base.lastIndexOf(".")
  const core = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ""
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? fullTarget : path.join(dir, `${core} (${i})${ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error("Za dużo plików o tej nazwie")
}

export class NameClash extends Error {
  constructor(public name: string) {
    super(`Plik ${name} już tu jest`)
    this.name = "NameClash"
  }
}

/**
 * Przeniesienie NIGDY nie nadpisuje. Bez tego sprawdzenia zmiana nazwy na istniejącą
 * kasowała tamten plik bez śladu i bez kosza.
 */
export async function move(
  user: string,
  fromPath: string,
  toPath: string,
  onCollision: "failed" | "obie" = "failed",
) {
  const a = safePath(user, fromPath).cel
  const b = safePath(user, toPath).cel
  if (a === b) return toPath
  await fs.mkdir(path.dirname(b), { recursive: true })
  let cel = b
  try {
    await fs.access(b)
    if (onCollision === "failed") throw new NameClash(path.basename(b))
    cel = await freeName(b)
  } catch (e) {
    if (e instanceof NameClash) throw e
  }
  await fs.rename(a, cel)
  const { root } = safePath(user, ".")
  return path.relative(root, cel)
}

/** Ruch między „Moimi plikami" a teczką sprawy to zawsze kopia — oryginał zostaje. */
export async function copy(user: string, fromPath: string, toPath: string) {
  const a = safePath(user, fromPath).cel
  const b = safePath(user, toPath).cel
  await fs.mkdir(path.dirname(b), { recursive: true })
  const cel = await freeName(b)
  await fs.copyFile(a, cel)
  const { root } = safePath(user, ".")
  return path.relative(root, cel)
}

/** Kasowanie jest odwracalne — do kosza, nie w niebyt. W identyfikatorze siedzi CAŁA ścieżka źródłowa. */
export async function toTrash(user: string, wzgledna: string) {
  const { root, cel } = safePath(user, wzgledna)
  const id = `${Date.now()}__${encodeURIComponent(wzgledna)}`
  await fs.rename(cel, path.join(root, ".trash", id))
  return id
}

function splitId(id: string) {
  const i = id.indexOf("__")
  const stamp = Number(id.slice(0, i))
  const encoded = id.slice(i + 2)
  let basis: string
  try {
    basis = decodeURIComponent(encoded)
  } catch {
    basis = encoded
  }
  // wpisy sprzed wprowadzenia pełnej ścieżki trzymały samą nazwę pliku
  if (!basis.includes("/")) basis = path.join("Moje pliki", basis)
  return { basis, when: new Date(Number.isFinite(stamp) ? stamp : Date.now()).toISOString() }
}

export async function trash(user: string) {
  const { root } = safePath(user, ".")
  const dir = path.join(root, ".trash")
  await fs.mkdir(dir, { recursive: true })
  const entries = await fs.readdir(dir)
  return entries
    .filter((n) => n.includes("__"))
    .map((n) => {
      const { basis, when } = splitId(n)
      return { id: n, name: path.basename(basis), basis: path.dirname(basis), when }
    })
    .sort((a, b) => b.when.localeCompare(a.when))
}

/**
 * Przywracamy tam, SKĄD plik zniknął. Gdy tamtego folderu już nie ma — do „Moich plików",
 * i mówimy o tym wprost, zamiast po cichu podłożyć plik w innym miejscu.
 */
export async function restore(user: string, id: string) {
  if (id.includes("/") || id.includes("\\") || !id.includes("__"))
    throw new Error("Zły identyfikator")
  const { root } = safePath(user, ".")
  const source = path.join(root, ".trash", id)
  const { basis } = splitId(id)

  const folder = path.dirname(basis)
  let targetFolder = folder
  let landedElsewhere = false
  try {
    await fs.access(safePath(user, folder).cel)
  } catch {
    targetFolder = "Moje pliki"
    landedElsewhere = true
  }

  const cel = safePath(user, path.join(targetFolder, path.basename(basis))).cel
  await fs.mkdir(path.dirname(cel), { recursive: true })
  const free = await freeName(cel)
  await fs.rename(source, free)
  return { target: path.relative(root, free), landedElsewhere, pierwotny: folder }
}

/** Wszystkie foldery w „Moich plikach" — do wyboru miejsca przy przenoszeniu. */
export async function folders(
  user: string,
  relativeRoot = "Moje pliki",
  depth = 4,
): Promise<string[]> {
  const out: string[] = [relativeRoot]
  async function descend(wzgledna: string, level: number) {
    if (level >= depth) return
    let entries
    try {
      entries = await fs.readdir(safePath(user, wzgledna).cel, { withFileTypes: true })
    } catch {
      return
    }
    for (const w of entries) {
      if (!w.isDirectory() || w.name.startsWith(".")) continue
      const child = path.join(wzgledna, w.name)
      out.push(child)
      await descend(child, level + 1)
    }
  }
  await prepareDesk(user)
  await descend(relativeRoot, 0)
  return out
}

export function caseFolder(user: string, caseId: string) {
  return path.join("Sprawy", caseId)
}

export async function fullPath(user: string, wzgledna: string) {
  return safePath(user, wzgledna).cel
}
