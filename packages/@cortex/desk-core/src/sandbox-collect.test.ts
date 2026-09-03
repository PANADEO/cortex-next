// PLIK WYTWORZONY W PIASKOWNICY MA DOJŚĆ NA BIURKO — albo głośno nie dojść.
//
// DLACZEGO POWSTAŁ. Demon od początku wypisywał `produced` (różnicę migawek katalogu
// sprawy), lista wracała przez `sandbox.ts` aż do `runtime.ts` — i tam się kończyła.
// Nikt jej nie czytał. Skutek: kod w piaskownicy mógł złożyć arkusz albo narysować
// wykres, po czym plik ginął razem z katalogiem przy `dispose()`, a piaskownica umiała
// w praktyce wytworzyć wyłącznie TEKST wypisany na wyjście. To jest ogniwo, którego
// brakowało między „umiem policzyć" a „umiem zrobić dokument".
//
// Sprawdzamy ŚCIEŻKĄ ZASTĘPCZĄ (bez demona), bo ona przechodzi tę samą funkcję
// `collectFrom` i nie wymaga Dockera — a przy okazji ma własną regułę, której prawdziwa
// nie ma: musi sama odjąć pliki, które sama tam włożyła.

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
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-collect-"))
  process.env["DESK_DATA_DIR"] = dataDir
  // Demon MUSI być odłączony: ten plik sprawdza ścieżkę zastępczą, a przy ustawionym
  // gnieździe `create()` poszłoby do Dockera i test mierzyłby co innego.
  delete process.env["DESK_SANDBOX_SOCKET"]
  vi.resetModules()
  sandbox = await import("./sandbox")
  storage = await import("./desk-storage")
  await storage.createFolder(WHO, CASE)
})

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
})

/** Uruchamia kod w piaskownicy i zabiera to, co po nim zostało. */
async function run(code: string, mounts: sandbox.Mount[] = []) {
  const box = await sandbox.create({ user: WHO, caseId: "proba", mounts })
  try {
    const outcome = await box.exec(code)
    const got = await box.collect(CASE, outcome.produced)
    return { outcome, ...got }
  } finally {
    await box.dispose()
  }
}

const onDesk = async () =>
  (await storage.list(WHO, CASE)).map((one: { name: string }) => one.name).sort()

describe("piaskownica oddaje pliki na biurko", () => {
  it("plik zapisany przez kod ląduje w teczce sprawy", async () => {
    const { kept, skipped } = await run(
      `require("fs").writeFileSync("zestawienie.csv", "a,b\\n1,2\\n")`,
    )
    expect(skipped).toEqual([])
    expect(kept).toHaveLength(1)
    expect(await onDesk()).toContain("zestawienie.csv")
    // Zawartość, nie sama nazwa: plik pusty o właściwej nazwie przeszedłby asercję wyżej.
    expect(await storage.read(WHO, `${CASE}/zestawienie.csv`)).toContain("1,2")
  })

  it("NIE nadpisuje pliku, który już leży w teczce sprawy", async () => {
    // Nadpisanie kasuje cudzą pracę bez śladu. „(2)" obok jest brzydsze i bezpieczne.
    await storage.write(WHO, `${CASE}/zestawienie.csv`, "STARE")
    await run(`require("fs").writeFileSync("zestawienie.csv", "NOWE")`)
    expect(await storage.read(WHO, `${CASE}/zestawienie.csv`)).toBe("STARE")
    expect((await onDesk()).some((n) => n.includes("(2)"))).toBe(true)
  })

  it("plik wniesiony Z BIURKA nie wraca jako rzecz wytworzona", async () => {
    // Ścieżka zastępcza czyta katalog, a nie różnicę migawek — więc bez odejmowania
    // każdy montaż wracałby jako nowy plik i teczka puchłaby z tury na turę.
    await storage.write(WHO, `${CASE}/wejscie.csv`, "x")
    const { kept } = await run(`console.log("nic nie zapisuję")`, [
      { fromDesk: `${CASE}/wejscie.csv`, as: "wejscie.csv", write: false },
    ])
    expect(kept).toEqual([])
  })

  it("nazwa ze ścieżką nie wyprowadza pliku poza teczkę sprawy", async () => {
    // Nazwa przychodzi od demona, czyli spoza tego procesu. „../../tajne.csv" ma być
    // plikiem o takiej nazwie, a nie drogą na cudze biurko.
    const box = await sandbox.create({ user: WHO, caseId: "proba", mounts: [] })
    try {
      await box.exec(`require("fs").writeFileSync("plik.csv", "x")`)
      const { kept } = await box.collect(CASE, ["../../../plik.csv"])
      expect(kept).toHaveLength(1)
      expect(kept[0]).toContain(CASE)
      expect(kept[0]).not.toContain("..")
    } finally {
      await box.dispose()
    }
  })

  it("plik za duży jest pominięty I POWIEDZIANY, a nie zgubiony po cichu", async () => {
    const { kept, skipped } = await run(
      `require("fs").writeFileSync("wielki.bin", Buffer.alloc(26 * 1024 * 1024))`,
    )
    expect(kept).toEqual([])
    expect(skipped).toEqual([{ name: "wielki.bin", why: "too-big" }])
  })

  it("przy zalewie plików bierze sufit i mówi, ilu nie wziął", async () => {
    const { kept, skipped } = await run(
      `for (let i = 0; i < 30; i++) require("fs").writeFileSync("p" + i + ".txt", "x")`,
    )
    expect(kept).toHaveLength(20)
    expect(skipped).toHaveLength(10)
    expect(skipped.every((one) => one.why === "too-many")).toBe(true)
  })
})
