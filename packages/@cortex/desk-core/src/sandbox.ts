import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fullPath } from "./desk-storage"
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
    async dispose() {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {})
    },
  }
}
