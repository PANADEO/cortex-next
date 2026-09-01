import { promises as fs } from "node:fs"
import path from "node:path"
import type { PlikMeta } from "./typy"

const BAZA = path.resolve(process.env.DESK_DATA_DIR ?? "./.data")

/**
 * F2 · BIURKO — warstwa plików, TRWAŁA i oddzielona od sandboxa.
 * W POC katalog na dysku; w produkcji usługa desk-store.
 * Reguła: powłoka nigdy nie sięga do dysku bezpośrednio, wyłącznie tędy.
 */
function bezpiecznaSciezka(uzytkownik: string, wzgledna: string) {
  const korzen = path.join(BAZA, "biurka", uzytkownik)
  const cel = path.resolve(korzen, wzgledna.replace(/^\/+/, ""))
  if (cel !== korzen && !cel.startsWith(korzen + path.sep)) {
    throw new Error("Ścieżka poza biurkiem")
  }
  return { korzen, cel }
}

export async function przygotujBiurko(uzytkownik: string) {
  const { korzen } = bezpiecznaSciezka(uzytkownik, ".")
  await fs.mkdir(path.join(korzen, "Moje pliki"), { recursive: true })
  await fs.mkdir(path.join(korzen, "Sprawy"), { recursive: true })
  await fs.mkdir(path.join(korzen, ".kosz"), { recursive: true })
  return korzen
}

export async function lista(uzytkownik: string, wzgledna = "Moje pliki"): Promise<PlikMeta[]> {
  await przygotujBiurko(uzytkownik)
  const { korzen, cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(cel, { recursive: true })
  const wpisy = await fs.readdir(cel, { withFileTypes: true })
  const out: PlikMeta[] = []
  for (const w of wpisy) {
    if (w.name.startsWith(".")) continue
    const pelna = path.join(cel, w.name)
    const st = await fs.stat(pelna)
    out.push({
      sciezka: path.relative(korzen, pelna),
      nazwa: w.name,
      katalog: w.isDirectory(),
      rozmiar: st.size,
      zmieniony: st.mtime.toISOString(),
    })
  }
  return out.sort(
    (a, b) => Number(b.katalog) - Number(a.katalog) || a.nazwa.localeCompare(b.nazwa, "pl"),
  )
}

export async function czytaj(uzytkownik: string, wzgledna: string): Promise<string> {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  return fs.readFile(cel, "utf8")
}

export async function czytajBinarnie(uzytkownik: string, wzgledna: string): Promise<Buffer> {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  return fs.readFile(cel)
}

export async function zapisz(uzytkownik: string, wzgledna: string, tresc: string | Buffer) {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(path.dirname(cel), { recursive: true })
  await fs.writeFile(cel, tresc)
  return wzgledna
}

/** Wgranie nigdy nie nadpisuje tego, co już jest — drugi „faktury.csv" ląduje jako „faktury (2).csv". */
export async function zapiszNowy(uzytkownik: string, wzgledna: string, tresc: string | Buffer) {
  const { korzen, cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(path.dirname(cel), { recursive: true })
  const wolna = await wolnaNazwa(cel)
  await fs.writeFile(wolna, tresc)
  return path.relative(korzen, wolna)
}

export async function utworzKatalog(uzytkownik: string, wzgledna: string) {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(cel, { recursive: true })
}

/** Nazwa, która na pewno nikogo nie nadpisze: „raport.md" → „raport (2).md". */
async function wolnaNazwa(pelnaDocelowa: string): Promise<string> {
  const kat = path.dirname(pelnaDocelowa)
  const baza = path.basename(pelnaDocelowa)
  const kropka = baza.lastIndexOf(".")
  const rdzen = kropka > 0 ? baza.slice(0, kropka) : baza
  const ext = kropka > 0 ? baza.slice(kropka) : ""
  for (let i = 1; i < 500; i++) {
    const kandydat = i === 1 ? pelnaDocelowa : path.join(kat, `${rdzen} (${i})${ext}`)
    try {
      await fs.access(kandydat)
    } catch {
      return kandydat
    }
  }
  throw new Error("Za dużo plików o tej nazwie")
}

export class Kolizja extends Error {
  constructor(public nazwa: string) {
    super(`Plik ${nazwa} już tu jest`)
    this.name = "Kolizja"
  }
}

/**
 * Przeniesienie NIGDY nie nadpisuje. Bez tego sprawdzenia zmiana nazwy na istniejącą
 * kasowała tamten plik bez śladu i bez kosza.
 */
export async function przenies(
  uzytkownik: string,
  zSciezki: string,
  doSciezki: string,
  gdyKolizja: "blad" | "obie" = "blad",
) {
  const a = bezpiecznaSciezka(uzytkownik, zSciezki).cel
  const b = bezpiecznaSciezka(uzytkownik, doSciezki).cel
  if (a === b) return doSciezki
  await fs.mkdir(path.dirname(b), { recursive: true })
  let cel = b
  try {
    await fs.access(b)
    if (gdyKolizja === "blad") throw new Kolizja(path.basename(b))
    cel = await wolnaNazwa(b)
  } catch (e) {
    if (e instanceof Kolizja) throw e
  }
  await fs.rename(a, cel)
  const { korzen } = bezpiecznaSciezka(uzytkownik, ".")
  return path.relative(korzen, cel)
}

/** Ruch między „Moimi plikami" a teczką sprawy to zawsze kopia — oryginał zostaje. */
export async function kopiuj(uzytkownik: string, zSciezki: string, doSciezki: string) {
  const a = bezpiecznaSciezka(uzytkownik, zSciezki).cel
  const b = bezpiecznaSciezka(uzytkownik, doSciezki).cel
  await fs.mkdir(path.dirname(b), { recursive: true })
  const cel = await wolnaNazwa(b)
  await fs.copyFile(a, cel)
  const { korzen } = bezpiecznaSciezka(uzytkownik, ".")
  return path.relative(korzen, cel)
}

/** Kasowanie jest odwracalne — do kosza, nie w niebyt. W identyfikatorze siedzi CAŁA ścieżka źródłowa. */
export async function doKosza(uzytkownik: string, wzgledna: string) {
  const { korzen, cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  const id = `${Date.now()}__${encodeURIComponent(wzgledna)}`
  await fs.rename(cel, path.join(korzen, ".kosz", id))
  return id
}

function rozbijId(id: string) {
  const i = id.indexOf("__")
  const stempel = Number(id.slice(0, i))
  const zakodowana = id.slice(i + 2)
  let skad: string
  try {
    skad = decodeURIComponent(zakodowana)
  } catch {
    skad = zakodowana
  }
  // wpisy sprzed wprowadzenia pełnej ścieżki trzymały samą nazwę pliku
  if (!skad.includes("/")) skad = path.join("Moje pliki", skad)
  return { skad, kiedy: new Date(Number.isFinite(stempel) ? stempel : Date.now()).toISOString() }
}

export async function kosz(uzytkownik: string) {
  const { korzen } = bezpiecznaSciezka(uzytkownik, ".")
  const dir = path.join(korzen, ".kosz")
  await fs.mkdir(dir, { recursive: true })
  const wpisy = await fs.readdir(dir)
  return wpisy
    .filter((n) => n.includes("__"))
    .map((n) => {
      const { skad, kiedy } = rozbijId(n)
      return { id: n, nazwa: path.basename(skad), skad: path.dirname(skad), kiedy }
    })
    .sort((a, b) => b.kiedy.localeCompare(a.kiedy))
}

/**
 * Przywracamy tam, SKĄD plik zniknął. Gdy tamtego folderu już nie ma — do „Moich plików",
 * i mówimy o tym wprost, zamiast po cichu podłożyć plik w innym miejscu.
 */
export async function przywroc(uzytkownik: string, id: string) {
  if (id.includes("/") || id.includes("\\") || !id.includes("__"))
    throw new Error("Zły identyfikator")
  const { korzen } = bezpiecznaSciezka(uzytkownik, ".")
  const zrodlo = path.join(korzen, ".kosz", id)
  const { skad } = rozbijId(id)

  const katalog = path.dirname(skad)
  let docelowyKatalog = katalog
  let wrociloGdzieIndziej = false
  try {
    await fs.access(bezpiecznaSciezka(uzytkownik, katalog).cel)
  } catch {
    docelowyKatalog = "Moje pliki"
    wrociloGdzieIndziej = true
  }

  const cel = bezpiecznaSciezka(uzytkownik, path.join(docelowyKatalog, path.basename(skad))).cel
  await fs.mkdir(path.dirname(cel), { recursive: true })
  const wolna = await wolnaNazwa(cel)
  await fs.rename(zrodlo, wolna)
  return { gdzie: path.relative(korzen, wolna), wrociloGdzieIndziej, pierwotny: katalog }
}

/** Wszystkie foldery w „Moich plikach" — do wyboru miejsca przy przenoszeniu. */
export async function katalogi(
  uzytkownik: string,
  korzenWzgledny = "Moje pliki",
  glebokosc = 4,
): Promise<string[]> {
  const out: string[] = [korzenWzgledny]
  async function zejdz(wzgledna: string, poziom: number) {
    if (poziom >= glebokosc) return
    let wpisy
    try {
      wpisy = await fs.readdir(bezpiecznaSciezka(uzytkownik, wzgledna).cel, { withFileTypes: true })
    } catch {
      return
    }
    for (const w of wpisy) {
      if (!w.isDirectory() || w.name.startsWith(".")) continue
      const dziecko = path.join(wzgledna, w.name)
      out.push(dziecko)
      await zejdz(dziecko, poziom + 1)
    }
  }
  await przygotujBiurko(uzytkownik)
  await zejdz(korzenWzgledny, 0)
  return out
}

export function katalogSprawy(uzytkownik: string, sprawaId: string) {
  return path.join("Sprawy", sprawaId)
}

export async function pelnaSciezka(uzytkownik: string, wzgledna: string) {
  return bezpiecznaSciezka(uzytkownik, wzgledna).cel
}
