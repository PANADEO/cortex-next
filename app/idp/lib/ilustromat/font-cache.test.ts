// Materializacja fontu do os.tmpdir() — pamięć procesu nie może przeżyć
// zniknięcia pliku. Sprzątacz /tmp (systemd-tmpfiles, presja na ephemeral
// storage w k8s, restart tmpfs) kasuje plik, a memo dalej twierdziło, że jest;
// efektem było TRWAŁE 500 "template-font-missing" aż do restartu Node —
// ponowne wgranie fontu nie pomagało, bo ścieżka to sha256 treści.

import { existsSync, readFileSync, rmSync, unlinkSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { clearFontCacheMemo, fontCacheDirectory, materializeFont, sha256 } from "./font-cache"

const BYTES = Buffer.from("udawany plik fontu — liczy się tylko tożsamość treści", "utf8")

afterEach(() => {
  clearFontCacheMemo()
  const target = pathFor(BYTES)
  if (existsSync(target)) rmSync(target)
})

function pathFor(bytes: Buffer): string {
  return `${fontCacheDirectory()}/${sha256(bytes)}.ttf`
}

describe("materializeFont()", () => {
  it("materializuje plik i zwraca ścieżkę zawartością-adresowalną", () => {
    const target = materializeFont(BYTES)

    expect(target).toBe(pathFor(BYTES))
    expect(readFileSync(target).equals(BYTES)).toBe(true)
  })

  it("materializuje PONOWNIE, gdy plik zniknął z tmpdir mimo trafienia w memo", () => {
    const target = materializeFont(BYTES)
    unlinkSync(target)
    expect(existsSync(target)).toBe(false)

    const again = materializeFont(BYTES)

    expect(again).toBe(target)
    expect(existsSync(again)).toBe(true)
    expect(readFileSync(again).equals(BYTES)).toBe(true)
  })

  it("przeżywa skasowanie całego katalogu cache", () => {
    materializeFont(BYTES)
    rmSync(fontCacheDirectory(), { recursive: true, force: true })

    const again = materializeFont(BYTES)

    expect(existsSync(again)).toBe(true)
  })
})
