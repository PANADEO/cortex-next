import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { PlikMeta } from './typy'

const BAZA = path.resolve(process.env.DESK_DATA_DIR ?? './.data')

/**
 * F2 · BIURKO — warstwa plików, TRWAŁA i oddzielona od sandboxa.
 * W POC katalog na dysku; w produkcji usługa desk-store.
 * Reguła: powłoka nigdy nie sięga do dysku bezpośrednio, wyłącznie tędy.
 */
function bezpiecznaSciezka(uzytkownik: string, wzgledna: string) {
  const korzen = path.join(BAZA, 'biurka', uzytkownik)
  const cel = path.resolve(korzen, wzgledna.replace(/^\/+/, ''))
  if (cel !== korzen && !cel.startsWith(korzen + path.sep)) {
    throw new Error('Ścieżka poza biurkiem')
  }
  return { korzen, cel }
}

export async function przygotujBiurko(uzytkownik: string) {
  const { korzen } = bezpiecznaSciezka(uzytkownik, '.')
  await fs.mkdir(path.join(korzen, 'Moje pliki'), { recursive: true })
  await fs.mkdir(path.join(korzen, 'Sprawy'), { recursive: true })
  await fs.mkdir(path.join(korzen, '.kosz'), { recursive: true })
  return korzen
}

export async function lista(uzytkownik: string, wzgledna = 'Moje pliki'): Promise<PlikMeta[]> {
  await przygotujBiurko(uzytkownik)
  const { korzen, cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(cel, { recursive: true })
  const wpisy = await fs.readdir(cel, { withFileTypes: true })
  const out: PlikMeta[] = []
  for (const w of wpisy) {
    if (w.name.startsWith('.')) continue
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
  return out.sort((a, b) => Number(b.katalog) - Number(a.katalog) || a.nazwa.localeCompare(b.nazwa, 'pl'))
}

export async function czytaj(uzytkownik: string, wzgledna: string): Promise<string> {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  return fs.readFile(cel, 'utf8')
}

export async function zapisz(uzytkownik: string, wzgledna: string, tresc: string | Buffer) {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(path.dirname(cel), { recursive: true })
  await fs.writeFile(cel, tresc)
  return wzgledna
}

export async function utworzKatalog(uzytkownik: string, wzgledna: string) {
  const { cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  await fs.mkdir(cel, { recursive: true })
}

export async function przenies(uzytkownik: string, zSciezki: string, doSciezki: string) {
  const a = bezpiecznaSciezka(uzytkownik, zSciezki).cel
  const b = bezpiecznaSciezka(uzytkownik, doSciezki).cel
  await fs.mkdir(path.dirname(b), { recursive: true })
  await fs.rename(a, b)
}

/** Kasowanie jest odwracalne — do kosza, nie w niebyt. */
export async function doKosza(uzytkownik: string, wzgledna: string) {
  const { korzen, cel } = bezpiecznaSciezka(uzytkownik, wzgledna)
  const nazwa = `${Date.now()}__${path.basename(cel)}`
  await fs.rename(cel, path.join(korzen, '.kosz', nazwa))
  return nazwa
}

export async function kosz(uzytkownik: string) {
  const { korzen } = bezpiecznaSciezka(uzytkownik, '.')
  const dir = path.join(korzen, '.kosz')
  await fs.mkdir(dir, { recursive: true })
  const wpisy = await fs.readdir(dir)
  return wpisy.map((n) => ({ id: n, nazwa: n.split('__').slice(1).join('__') }))
}

export async function przywroc(uzytkownik: string, id: string) {
  const { korzen } = bezpiecznaSciezka(uzytkownik, '.')
  const zrodlo = path.join(korzen, '.kosz', id)
  const nazwa = id.split('__').slice(1).join('__')
  await fs.rename(zrodlo, path.join(korzen, 'Moje pliki', nazwa))
}

export function katalogSprawy(uzytkownik: string, sprawaId: string) {
  return path.join('Sprawy', sprawaId)
}

export async function pelnaSciezka(uzytkownik: string, wzgledna: string) {
  return bezpiecznaSciezka(uzytkownik, wzgledna).cel
}
