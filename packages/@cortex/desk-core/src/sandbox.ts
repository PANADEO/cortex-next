import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { pelnaSciezka } from './biurko'

export type Montaz = { zBiurka: string; jako: string; zapis: boolean }
export type Limity = { sekundy: number; pamiecMb: number }
export type Uchwyt = {
  id: string
  katalog: string
  exec(kod: string): Promise<{ ok: boolean; wyjscie: string }>
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
export async function utworz(opts: {
  uzytkownik: string
  sprawaId: string
  montaze: Montaz[]
  limity?: Limity
  egress?: string[] // NIEEGZEKWOWANE w POC — patrz E2 w wektorze rozwoju
}): Promise<Uchwyt> {
  const limity = opts.limity ?? { sekundy: 30, pamiecMb: 512 }
  // realpath jest konieczny: na macOS os.tmpdir() zwraca /var/..., a faktyczna ścieżka to
  // /private/var/... — bez rozwinięcia dowiązania uprawnienia nie objęłyby własnego katalogu
  const katalog = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), `desk-${opts.sprawaId}-`)))

  for (const m of opts.montaze) {
    try {
      const zrodlo = await pelnaSciezka(opts.uzytkownik, m.zBiurka)
      const cel = path.join(katalog, m.jako)
      await fs.mkdir(path.dirname(cel), { recursive: true })
      await fs.cp(zrodlo, cel, { recursive: true })
    } catch {
      /* montaż nieistniejącej ścieżki jest cichy — agent zobaczy pusty katalog */
    }
  }

  return {
    id: path.basename(katalog),
    katalog,
    async exec(kod: string) {
      return new Promise((resolve) => {
        // Jawna lista zmiennych środowiskowych. NIGDY ...process.env —
        // to jest ta sama dziura, której nie chcemy odtworzyć za darmo.
        const env = { PATH: process.env.PATH ?? '', HOME: katalog } as unknown as NodeJS.ProcessEnv
        const flagi = [
          '--permission',
          `--allow-fs-read=${katalog}/*`,
          `--allow-fs-write=${katalog}/*`,
          `--max-old-space-size=${limity.pamiecMb}`,
        ]
        const p = spawn(process.execPath, [...flagi, '-e', kod], {
          cwd: katalog,
          env,
          timeout: limity.sekundy * 1000,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let out = ''
        p.stdout?.on('data', (d: Buffer) => (out += d.toString()))
        p.stderr?.on('data', (d: Buffer) => (out += d.toString()))
        p.on('close', (code) => resolve({ ok: code === 0, wyjscie: out.slice(0, 8000) }))
        p.on('error', (e) => resolve({ ok: false, wyjscie: String(e) }))
      })
    },
    async dispose() {
      await fs.rm(katalog, { recursive: true, force: true }).catch(() => {})
    },
  }
}
