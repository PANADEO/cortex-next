import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fullPath, writeNew } from "./desk-storage"
import { createBox, daemonConfigured, disposeBox, execBox } from "./sandbox-daemon"

/**
 * Sufit wyjścia ścieżki ZASTĘPCZEJ. Było 8 000 znaków i było obcinane po cichu. Przez
 * piaskownicę przechodzą wyciągi z dokumentów i zestawienia, więc osiem tysięcy znaków
 * to mniej niż jedna strona tabeli — a prawdziwe sufity ustawia demon, nie to miejsce.
 */
const FALLBACK_OUTPUT = 200_000

export type Mount = { fromDesk: string; as: string; write: boolean }
export type Limits = { seconds: number; memoryMb: number }
/**
 * `stopped` i `produced` są OPCJONALNE, bo ścieżka zastępcza ich nie zna. Wołający ma je
 * traktować jak informację, której może nie być — a nie jak obietnicę.
 */
export type ExecOutcome = {
  ok: boolean
  output: string
  stopped?: string
  produced?: string[]
}
export type Handle = {
  id: string
  folder: string
  exec(code: string): Promise<ExecOutcome>
  /**
   * Przenosi na biurko pliki, które kod zostawił. WOŁAĆ PRZED `dispose()` — potem
   * katalog już nie istnieje. `produced` bierzemy z wyniku `exec`; ścieżka zapasowa
   * go nie zna, więc czyta katalog sama.
   */
  collect(target: string, produced?: string[]): Promise<Collected>
  dispose(): Promise<void>
}

/**
 * F3 · SANDBOX — proces potomny z zamkniętym systemem plików.
 *
 * CO JEST DOMKNIĘTE: model uprawnień Node (--permission) odcina cały system plików poza
 * katalogiem roboczym. Zweryfikowane: próba odczytu cudzego biurka albo pliku .env.local
 * kończy się błędem uprawnień, a nie danymi.
 *
 * CZEGO NADAL NIE MA — i nie wolno tego przemilczeć:
 *   · SIEĆ jest otwarta. Model uprawnień Node jej nie obejmuje, więc kod może wyjść na zewnątrz.
 *   · LIMIT PAMIĘCI jest pozorny. --max-old-space-size ogranicza stertę JS, ale Buffer.alloc
 *     alokuje poza nią, więc proces potrafi zająć wielokrotność deklarowanego limitu.
 *   · Proces działa jako ten sam użytkownik systemu co aplikacja.
 *
 * Dopóki to nie zostanie zamknięte (E2: microsandbox / Kata / gVisor albo kontener bez sieci),
 * zdolność `kod.uruchom` NIE POWINNA być domyślnie przyznawana w środowisku klienta.
 *
 * Sygnatura przyjmuje `montaze` i `egress` JUŻ TERAZ, mimo że `egress` nie jest egzekwowany:
 * jeśli tego parametru nie będzie tutaj, nie będzie miał gdzie się pojawić, gdy pod spód
 * wejdzie prawdziwy broker.
 */
/**
 * Kopiuje pliki z biurka do katalogu roboczego sprawy. Wspólne dla obu ścieżek, bo to
 * jedyne miejsce, które wie, co znaczy „Moje pliki" — demon nie ma prawa tego wiedzieć
 * i nie dostaje dostępu do cudzych biurek, tylko gotowe bajty pod nazwą.
 */
/** Ile plików i ile bajtów wolno wynieść z jednej tury. */
const COLLECT_FILES = 20
const COLLECT_BYTES = 50 * 1024 * 1024
const COLLECT_ONE = 25 * 1024 * 1024

export type Collected = {
  /** ścieżki NA BIURKU — te, które naprawdę powstały */
  kept: string[]
  /** nazwy pominięte razem z powodem, do powiedzenia człowiekowi */
  skipped: { name: string; why: "too-big" | "too-many" | "no-room" | "unreadable" }[]
}

/**
 * ZABIERA Z PIASKOWNICY TO, CO KOD NAPRAWDĘ WYTWORZYŁ — lustrzane odbicie `mountInto`.
 *
 * DLACZEGO ISTNIEJE. Demon od początku wypisuje `produced` (różnica migawek katalogu
 * sprawy przed i po wykonaniu), ale nikt tej listy nie czytał: wracała aż tutaj i się
 * kończyła. Skutek był taki, że kod mógł narysować wykres albo złożyć dokument, a plik
 * ginął razem z katalogiem przy `dispose()` — czyli piaskownica umiała wytworzyć wyłącznie
 * TEKST wypisany na wyjście.
 *
 * Nie potrzeba do tego trasy pobierania po stronie demona: katalog sprawy jest
 * WSPÓLNY — `mountInto` już do niego pisze zwykłym `fs.cp`. Odczyt to ta sama droga
 * w drugą stronę.
 *
 * SUFITY SĄ TU, NIE W ZAUFANIU. Kod pisze model, więc pętla zostawiająca dziesięć tysięcy
 * plików albo jeden plik na gigabajt nie jest scenariuszem hipotetycznym. Pominięcie
 * MÓWI O SOBIE — cicha strata pliku byłaby gorsza niż jego brak, bo człowiek zobaczyłby
 * w wyjściu „zapisano wykres" i nie znalazłby go u siebie.
 */
async function collectFrom(
  folder: string,
  user: string,
  target: string,
  produced: string[],
): Promise<Collected> {
  const kept: string[] = []
  const skipped: Collected["skipped"] = []
  let budget = COLLECT_BYTES
  for (const name of produced) {
    if (kept.length >= COLLECT_FILES) {
      skipped.push({ name, why: "too-many" })
      continue
    }
    try {
      // `path.basename`, bo nazwa przychodzi od demona, a stamtąd nie przyjmujemy
      // ścieżek: „../../biurka/robert/tajne.csv" ma być plikiem o takiej nazwie,
      // a nie drogą na cudze biurko.
      const source = path.join(folder, path.basename(name))
      const info = await fs.stat(source)
      if (!info.isFile()) {
        skipped.push({ name, why: "unreadable" })
        continue
      }
      if (info.size > COLLECT_ONE) {
        skipped.push({ name, why: "too-big" })
        continue
      }
      if (info.size > budget) {
        skipped.push({ name, why: "no-room" })
        continue
      }
      const bytes = await fs.readFile(source)
      // `writeNew`, nie `write`: plik z piaskownicy NIGDY nie nadpisuje tego, co już
      // leży w teczce sprawy. „zestawienie.csv" obok „zestawienie (2).csv" jest gorsze
      // niż nadpisanie wyłącznie dla porządku — a nadpisanie kasuje cudzą pracę.
      kept.push(await writeNew(user, path.join(target, path.basename(name)), bytes))
      budget -= info.size
    } catch {
      skipped.push({ name, why: "unreadable" })
    }
  }
  return { kept, skipped }
}

async function mountInto(folder: string, user: string, mounts: Mount[]) {
  for (const m of mounts) {
    try {
      const source = await fullPath(user, m.fromDesk)
      const target = path.join(folder, m.as)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.cp(source, target, { recursive: true })
    } catch {
      /* montaż nieistniejącej ścieżki jest cichy — agent zobaczy pusty katalog */
    }
  }
}

export async function create(opts: {
  user: string
  caseId: string
  mounts: Mount[]
  limits?: Limits
  /** identyfikator środowiska z `GET /v1/presets`, NIGDY nazwa obrazu */
  preset?: string
}): Promise<Handle> {
  const limits = opts.limits ?? { seconds: 30, memoryMb: 512 }

  // PIASKOWNICA PRAWDZIWA, gdy demon jest podłączony. Wszystko poniżej tego `if` to ścieżka
  // ZASTĘPCZA, świadomie słabsza — jej ograniczenia są wypisane w komentarzu nad tą funkcją
  // i nie wolno ich przemilczeć tylko dlatego, że demon zwykle jest.
  if (daemonConfigured()) {
    const box = await createBox({
      user: opts.user,
      caseId: opts.caseId,
      ...(opts.preset === undefined ? {} : { preset: opts.preset }),
      limits: { seconds: limits.seconds, memoryMb: limits.memoryMb },
    })
    await mountInto(box.folder, opts.user, opts.mounts)
    return {
      id: box.id,
      folder: box.folder,
      async exec(code: string) {
        // Zapas 15 s ponad limit sprawy: chcemy usłyszeć od demona „timeout" jako WYNIK,
        // a nie zerwać połączenie i zgadywać, co się stało po drugiej stronie.
        const r = await execBox(box.id, code, (limits.seconds + 15) * 1000)
        return { ok: r.ok, output: r.output, stopped: r.stopped, produced: r.produced }
      },
      async collect(target: string, produced?: string[]) {
        return collectFrom(box.folder, opts.user, target, produced ?? [])
      },
      async dispose() {
        await disposeBox(box.id).catch(() => {})
      },
    }
  }

  // realpath jest konieczny: na macOS os.tmpdir() zwraca /var/..., a faktyczna ścieżka to
  // /private/var/... — bez rozwinięcia dowiązania uprawnienia nie objęłyby własnego katalogu
  const folder = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), `desk-${opts.caseId}-`)))

  await mountInto(folder, opts.user, opts.mounts)

  return {
    id: path.basename(folder),
    folder,
    async exec(code: string) {
      return new Promise((resolve) => {
        // Jawna lista zmiennych środowiskowych. NIGDY ...process.env —
        // to jest ta sama dziura, której nie chcemy odtworzyć za darmo.
        const env = { PATH: process.env.PATH ?? "", HOME: folder } as unknown as NodeJS.ProcessEnv
        const flags = [
          "--permission",
          `--allow-fs-read=${folder}/*`,
          `--allow-fs-write=${folder}/*`,
          `--max-old-space-size=${limits.memoryMb}`,
        ]
        const p = spawn(process.execPath, [...flags, "-e", code], {
          cwd: folder,
          env,
          timeout: limits.seconds * 1000,
          stdio: ["ignore", "pipe", "pipe"],
        })
        let out = ""
        p.stdout?.on("data", (d: Buffer) => (out += d.toString()))
        p.stderr?.on("data", (d: Buffer) => (out += d.toString()))
        // CZWARTE ciche obcięcie w tym produkcie: `slice(0, 8000)` ucinało wynik i nie
        // mówiło o tym nikomu, więc wynik obcięty był nieodróżnialny od kompletnego.
        p.on("close", (code) => {
          const clipped = out.length > FALLBACK_OUTPUT
          resolve({
            ok: code === 0 && !clipped,
            output: clipped ? out.slice(0, FALLBACK_OUTPUT) : out,
            ...(clipped ? { stopped: "output" } : {}),
          })
        })
        p.on("error", (e) => resolve({ ok: false, output: String(e) }))
      })
    },
    async collect(target: string, produced?: string[]) {
      // Ścieżka zapasowa nie dostaje listy od nikogo — demon liczy ją z migawek, a tutaj
      // demona nie ma. Czytamy katalog i ODEJMUJEMY to, co sami tam włożyliśmy: plik
      // wniesiony z biurka nie jest rzeczą wytworzoną i nie ma prawa wrócić jako nowy.
      const mounted = new Set(opts.mounts.map((m) => path.basename(m.as)))
      const found =
        produced ??
        (await fs.readdir(folder).catch(() => [] as string[])).filter((one) => !mounted.has(one))
      return collectFrom(folder, opts.user, target, found)
    },
    async dispose() {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {})
    },
  }
}
