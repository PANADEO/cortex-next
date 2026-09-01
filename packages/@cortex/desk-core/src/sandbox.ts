import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fullPath } from "./desk-storage"

export type Mount = { fromDesk: string; as: string; write: boolean }
export type Limits = { seconds: number; memoryMb: number }
export type Handle = {
  id: string
  folder: string
  exec(code: string): Promise<{ ok: boolean; output: string }>
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
export async function create(opts: {
  user: string
  caseId: string
  mounts: Mount[]
  limits?: Limits
  egress?: string[] // NIEEGZEKWOWANE w POC — patrz E2 w wektorze rozwoju
}): Promise<Handle> {
  const limits = opts.limits ?? { seconds: 30, memoryMb: 512 }
  // realpath jest konieczny: na macOS os.tmpdir() zwraca /var/..., a faktyczna ścieżka to
  // /private/var/... — bez rozwinięcia dowiązania uprawnienia nie objęłyby własnego katalogu
  const folder = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), `desk-${opts.caseId}-`)))

  for (const m of opts.mounts) {
    try {
      const source = await fullPath(opts.user, m.fromDesk)
      const cel = path.join(folder, m.as)
      await fs.mkdir(path.dirname(cel), { recursive: true })
      await fs.cp(source, cel, { recursive: true })
    } catch {
      /* montaż nieistniejącej ścieżki jest cichy — agent zobaczy pusty katalog */
    }
  }

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
        p.on("close", (code) => resolve({ ok: code === 0, output: out.slice(0, 8000) }))
        p.on("error", (e) => resolve({ ok: false, output: String(e) }))
      })
    },
    async dispose() {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {})
    },
  }
}
