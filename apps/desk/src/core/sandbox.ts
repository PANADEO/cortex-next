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
 * F3 · SANDBOX — w POC zwykły folder i proces potomny, dokładnie jak dziś tryb lokalny.
 *
 * Sygnatura przyjmuje `montaze` i `egress` JUŻ TERAZ, mimo że ich nie egzekwuje:
 * jeśli tych parametrów nie będzie tutaj, nie będą miały gdzie się pojawić,
 * gdy pod spód wejdzie broker z microsandboxem albo Katą.
 */
export async function utworz(opts: {
  uzytkownik: string
  sprawaId: string
  montaze: Montaz[]
  limity?: Limity
  egress?: string[] // NIEEGZEKWOWANE w POC — patrz E2 w wektorze rozwoju
}): Promise<Uchwyt> {
  const limity = opts.limity ?? { sekundy: 30, pamiecMb: 512 }
  const katalog = await fs.mkdtemp(path.join(os.tmpdir(), `desk-${opts.sprawaId}-`))

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
        const p = spawn(process.execPath, ['-e', kod], {
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
