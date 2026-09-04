// NIEUDANY MONTAŻ MA BYĆ SŁYSZALNY — bo cisza po nim wraca gorszym błędem.
//
// DLACZEGO POWSTAŁ. `mountInto` łykało wyjątek z komentarzem „montaż nieistniejącej ścieżki
// jest cichy — agent zobaczy pusty katalog". Zmierzone na prawdziwej sprawie (477f6c09),
// co agent widzi zamiast pustego katalogu: piaskownica wstaje bez pliku, kod rusza i pada
// na `FileNotFoundError`, a w przebiegu staje krzyżyk ze śladem stosu Pythona. Osoba, dla
// której to jest zbudowane, dostawała komunikat interpretera zamiast zdania „nie ma
// takiego pliku" — o pomyłce, która była zwykłą literówką w ścieżce.
//
// Sprawdzamy ŚCIEŻKĄ ZASTĘPCZĄ (bez demona), tak samo jak `sandbox-collect.test.ts`:
// `mountInto` jest wspólne dla obu gałęzi, a ta nie wymaga Dockera.

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let dataDir = ""
let sandbox: typeof import("./sandbox")
let storage: typeof import("./desk-storage")

const CASE = "Sprawy/proba"
const WHO = "anna"

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-mount-"))
  process.env["DESK_DATA_DIR"] = dataDir
  delete process.env["DESK_SANDBOX_SOCKET"]
  vi.resetModules()
  sandbox = await import("./sandbox")
  storage = await import("./desk-storage")
  await storage.createFolder(WHO, CASE)
  await storage.write(WHO, `${CASE}/dane.csv`, "nr,netto\n1/08,1000\n")
})

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
})

const box = (files: string[]) =>
  sandbox.create({
    user: WHO,
    caseId: "proba",
    mounts: files.map((f) => ({ fromDesk: f, as: path.basename(f), write: false })),
  })

describe("montaż plików do piaskownicy", () => {
  it("plik, który jest, montuje się i NIE trafia na listę braków", async () => {
    const k = await box([`${CASE}/dane.csv`])
    expect(k.missing).toEqual([])
    // Kontrola pozytywna do testu niżej: lista pusta ma znaczyć „plik naprawdę leży
    // w katalogu", a nie „nikt nie sprawdzał".
    await expect(fs.readFile(path.join(k.folder, "dane.csv"), "utf8")).resolves.toContain("netto")
    await k.dispose()
  })

  it("plik, którego nie ma, WRACA NAZWANY — a katalog zostaje bez niego", async () => {
    const k = await box([`${CASE}/nie-ma-mnie.xlsx`])
    expect(k.missing).toEqual([`${CASE}/nie-ma-mnie.xlsx`])
    await expect(fs.access(path.join(k.folder, "nie-ma-mnie.xlsx"))).rejects.toThrow()
    await k.dispose()
  })

  it("z kilku plików wraca DOKŁADNIE ten brakujący, reszta się montuje", async () => {
    // Częściowy montaż jest najgroźniejszym z trzech przypadków: piaskownica wygląda
    // na sprawną, a policzone jest z niepełnych danych.
    const k = await box([`${CASE}/dane.csv`, `${CASE}/widmo.csv`])
    expect(k.missing).toEqual([`${CASE}/widmo.csv`])
    await expect(fs.access(path.join(k.folder, "dane.csv"))).resolves.toBeUndefined()
    await k.dispose()
  })

  it("cudze biurko jest brakiem, a nie wyciekiem", async () => {
    // Ścieżka spoza biurka tej osoby ma się zachować dokładnie jak plik nieistniejący:
    // ten sam wynik, żadnej informacji o tym, że u kogoś innego coś takiego jest.
    await storage.createFolder("robert", "Moje pliki")
    await storage.write("robert", "Moje pliki/tajne.csv", "x\n")
    const k = await box(["../robert/Moje pliki/tajne.csv"])
    expect(k.missing).toHaveLength(1)
    await expect(fs.access(path.join(k.folder, "tajne.csv"))).rejects.toThrow()
    await k.dispose()
  })
})
