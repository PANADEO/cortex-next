import { promises as fs } from "node:fs"
import path from "node:path"
import { MY_FILES, SHARED } from "./folder"
import type { FileMeta, TrashEntry } from "./types"

const BASE = path.resolve(process.env.DESK_DATA_DIR ?? "./.data")

/**
 * F2 · BIURKO — warstwa plików, TRWAŁA i oddzielona od sandboxa.
 * W POC katalog na dysku; w produkcji usługa desk-store.
 * Reguła: powłoka nigdy nie sięga do dysku bezpośrednio, wyłącznie tędy.
 */
/**
 * Rozwiązuje ścieżkę LOGICZNĄ na fizyczną, wybierając jeden z dwóch korzeni: biurko tej
 * osoby albo wspólną półkę. Sprawdzenie zawierania jest robione OSOBNO dla każdego korzenia
 * i po rozwinięciu ścieżki — to jest jedyne miejsce, które stoi między nazwą podaną przez
 * model a dyskiem, więc dwa korzenie nie mogą znaczyć dwóch różnych rygorów.
 */
function safePath(user: string, wzgledna: string) {
  const clean = wzgledna.replace(/^\/+/, "")
  // Segment, nie prefiks napisu: „Wspólne plikiXYZ" ma NIE trafiać na wspólną półkę.
  const shared = clean === SHARED || clean.startsWith(SHARED + "/")
  const root = shared ? path.join(BASE, "wspolne") : path.join(BASE, "biurka", user)
  const inner = shared ? clean.slice(SHARED.length).replace(/^\/+/, "") : clean
  const target = path.resolve(root, inner)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Ścieżka poza biurkiem")
  }
  return { root, target, shared }
}

/**
 * Droga powrotna: z fizycznej ścieżki na logiczną. Bez tego lista plików ze wspólnej półki
 * oddawałaby ścieżki bez prefiksu, a wołający odesłałby je z powrotem jako ścieżki
 * we WŁASNYM biurku — czyli plik znikałby przy pierwszym kliknięciu.
 */
function logical(root: string, full: string, shared: boolean) {
  const rel = path.relative(root, full)
  return shared ? path.join(SHARED, rel) : rel
}

export async function prepareDesk(user: string) {
  const { root } = safePath(user, ".")
  await fs.mkdir(path.join(root, MY_FILES), { recursive: true })
  await fs.mkdir(path.join(root, "Sprawy"), { recursive: true })
  await fs.mkdir(path.join(root, ".trash"), { recursive: true })
  // Wspólna półka jest JEDNA na instalację, więc powstaje przy pierwszym biurku
  // i nie jest niczyja.
  await fs.mkdir(path.join(BASE, "wspolne"), { recursive: true })
  return root
}

export async function list(user: string, wzgledna = MY_FILES): Promise<FileMeta[]> {
  await prepareDesk(user)
  const { root, target, shared } = safePath(user, wzgledna)
  await fs.mkdir(target, { recursive: true })
  const entries = await fs.readdir(target, { withFileTypes: true })
  const out: FileMeta[] = []
  for (const w of entries) {
    if (w.name.startsWith(".")) continue
    const full = path.join(target, w.name)
    const st = await fs.stat(full)
    out.push({
      path: logical(root, full, shared),
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
  const { target } = safePath(user, wzgledna)
  return fs.readFile(target, "utf8")
}

export async function readBinary(user: string, wzgledna: string): Promise<Buffer> {
  const { target } = safePath(user, wzgledna)
  return fs.readFile(target)
}

export async function write(user: string, wzgledna: string, text: string | Buffer) {
  const { target } = safePath(user, wzgledna)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text)
  return wzgledna
}

/** Wgranie nigdy nie nadpisuje tego, co już jest — drugi „faktury.csv" ląduje jako „faktury (2).csv". */
export async function writeNew(user: string, wzgledna: string, text: string | Buffer) {
  const { root, target } = safePath(user, wzgledna)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const free = await freeName(target)
  await fs.writeFile(free, text)
  return path.relative(root, free)
}

export async function createFolder(user: string, wzgledna: string) {
  const { target } = safePath(user, wzgledna)
  await fs.mkdir(target, { recursive: true })
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
  onCollision: "error" | "both" = "error",
) {
  const a = safePath(user, fromPath).target
  const b = safePath(user, toPath).target
  if (a === b) return toPath
  await fs.mkdir(path.dirname(b), { recursive: true })
  let target = b
  try {
    await fs.access(b)
    if (onCollision === "error") throw new NameClash(path.basename(b))
    target = await freeName(b)
  } catch (e) {
    if (e instanceof NameClash) throw e
  }
  await fs.rename(a, target)
  const { root } = safePath(user, ".")
  return path.relative(root, target)
}

/** Ruch między „Moimi plikami" a teczką sprawy to zawsze kopia — oryginał zostaje. */
export async function copy(user: string, fromPath: string, toPath: string) {
  const a = safePath(user, fromPath).target
  const b = safePath(user, toPath).target
  await fs.mkdir(path.dirname(b), { recursive: true })
  const target = await freeName(b)
  await fs.copyFile(a, target)
  const { root } = safePath(user, ".")
  return path.relative(root, target)
}

/** Kasowanie jest odwracalne — do kosza, nie w niebyt. W identyfikatorze siedzi CAŁA ścieżka źródłowa. */
export async function toTrash(user: string, wzgledna: string) {
  const { root, target } = safePath(user, wzgledna)
  const id = `${Date.now()}__${encodeURIComponent(wzgledna)}`
  await fs.rename(target, path.join(root, ".trash", id))
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
  if (!basis.includes("/")) basis = path.join(MY_FILES, basis)
  return { basis, when: new Date(Number.isFinite(stamp) ? stamp : Date.now()).toISOString() }
}

export async function trash(user: string): Promise<TrashEntry[]> {
  const { root } = safePath(user, ".")
  const dir = path.join(root, ".trash")
  await fs.mkdir(dir, { recursive: true })
  const entries = await fs.readdir(dir)
  return entries
    .filter((n) => n.includes("__"))
    .map((n) => {
      const { basis, when } = splitId(n)
      return { id: n, name: path.basename(basis), fromFolder: path.dirname(basis), when }
    })
    .sort((a, b) => b.when.localeCompare(a.when))
}

/**
 * Opróżnia kosz — nieodwracalnie.
 *
 * Do tej pory kosz nie miał ŻADNEJ drogi wyjścia: plik trafiał tam na zawsze, a lista
 * rosła bez granicy (zmierzone: 139 pozycji na biurku pokazowym). „Kasowanie jest
 * odwracalne" znaczyło w praktyce „kasowanie nie istnieje" — i było jednocześnie
 * cichym gromadzeniem danych klienta bez końca.
 */
export async function emptyTrash(user: string): Promise<number> {
  const { root } = safePath(user, ".")
  const dir = path.join(root, ".trash")
  await fs.mkdir(dir, { recursive: true })
  const entries = (await fs.readdir(dir)).filter((n) => n.includes("__"))
  for (const name of entries) {
    await fs.rm(path.join(dir, name), { recursive: true, force: true })
  }
  return entries.length
}

/**
 * Przywracamy tam, SKĄD plik zniknął. Gdy tamtego folderu już nie ma — do „Moich plików",
 * i mówimy o tym wprost, zamiast po cichu podłożyć plik w innym miejscu.
 */
/**
 * DOKĄD WRÓCI plik z kosza — policzone, ale jeszcze nie wykonane.
 *
 * Wyniesione z `restore`, bo brama wspólnej półki musi zapytać PRZED przeniesieniem,
 * a nie po. Do 03.09.2026 nie miała o co zapytać: `files.ts` sprawdzało `path`, `from`
 * i `to`, a przywracanie idzie po samym identyfikatorze z kosza — więc osoba, której
 * odebrano `shared.write` po wyrzuceniu firmowego wzoru pisma do własnego kosza,
 * odkładała go z powrotem na półkę bez żadnej zdolności. Brama pilnowana w połowie,
 * w wąskim przypadku, ale dokładnie ta sama klasa co poprzednie.
 *
 * Liczymy CEL RZECZYWISTY, nie pierwotny folder: gdy tamtego już nie ma, plik ląduje
 * w „Moich plikach" i wtedy zgoda na półkę nie jest potrzebna. Pytanie o folder
 * pierwotny odmawiałoby wtedy bez powodu.
 */
export async function restoreTarget(user: string, id: string) {
  if (id.includes("/") || id.includes("\\") || !id.includes("__"))
    throw new Error("Zły identyfikator")
  const { basis } = splitId(id)
  const folder = path.dirname(basis)
  try {
    await fs.access(safePath(user, folder).target)
    return { folder: folder, landedElsewhere: false }
  } catch {
    return { folder: MY_FILES, landedElsewhere: true }
  }
}

export async function restore(user: string, id: string) {
  if (id.includes("/") || id.includes("\\") || !id.includes("__"))
    throw new Error("Zły identyfikator")
  const { root } = safePath(user, ".")
  const source = path.join(root, ".trash", id)
  const { basis } = splitId(id)

  const folder = path.dirname(basis)
  const planned = await restoreTarget(user, id)
  const targetFolder = planned.folder
  const landedElsewhere = planned.landedElsewhere

  const target = safePath(user, path.join(targetFolder, path.basename(basis))).target
  await fs.mkdir(path.dirname(target), { recursive: true })
  const free = await freeName(target)
  await fs.rename(source, free)
  return { target: path.relative(root, free), landedElsewhere, originalFolder: folder }
}

/** Wszystkie foldery w „Moich plikach" — do wyboru miejsca przy przenoszeniu. */
export async function folders(user: string, relativeRoot = MY_FILES, depth = 4): Promise<string[]> {
  const out: string[] = [relativeRoot]
  async function descend(wzgledna: string, level: number) {
    if (level >= depth) return
    let entries
    try {
      entries = await fs.readdir(safePath(user, wzgledna).target, { withFileTypes: true })
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
  // Wspólna półka dochodzi do drzewa jako osobna gałąź, a nie jako podkatalog biurka —
  // bo nim nie jest. O tym, czy człowiek ją zobaczy, decyduje brama zdolności wyżej.
  if (relativeRoot === MY_FILES) {
    out.push(SHARED)
    await descend(SHARED, 0)
  }
  return out
}

export function caseFolder(user: string, caseId: string) {
  return path.join("Sprawy", caseId)
}

export async function fullPath(user: string, wzgledna: string) {
  return safePath(user, wzgledna).target
}
