// Wspólna półka: jedna dla wszystkich, i ANI JEDNEJ ścieżki poza nią.
//
// Ten katalog jako jedyny nie należy do konkretnego biurka, więc `safePath` przestaje mieć
// jeden korzeń i zaczyna mieć dwa. To jest dokładnie ten moment, w którym pojawiają się
// błędy przejścia po katalogach — dlatego granica ma tu test, który próbuje ją przekroczyć,
// a nie komentarz obiecujący, że jej się nie da.

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { MY_FILES, SHARED, isShared } from "./folder"
import { refuseShared } from "./shared-access"

let storage: typeof import("./desk-storage")
let base: string

beforeAll(async () => {
  base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "polka-")))
  process.env.DESK_DATA_DIR = base
  storage = await import("./desk-storage")
  await storage.prepareDesk("anna")
  await storage.prepareDesk("robert")
})

afterAll(async () => {
  await fs.rm(base, { recursive: true, force: true })
})

describe("Wspólna półka", () => {
  it("jest JEDNA — co odłoży Robert, widzi Anna", async () => {
    await storage.write("robert", `${SHARED}/cennik.csv`, "usluga,cena\naudyt,1000\n")
    const widziAnna = await storage.list("anna", SHARED)
    expect(widziAnna.map((f) => f.name)).toContain("cennik.csv")
    expect(await storage.read("anna", `${SHARED}/cennik.csv`)).toContain("audyt")
  })

  it("leży FIZYCZNIE poza biurkiem którejkolwiek osoby", async () => {
    // Gdyby siedziała w katalogu osoby, trafiałaby do piaskownicy razem z jej biurkiem.
    await expect(fs.stat(path.join(base, "wspolne", "cennik.csv"))).resolves.toBeTruthy()
    await expect(fs.stat(path.join(base, "biurka", "anna", SHARED))).rejects.toThrow()
  })

  it("oddaje ścieżki, które da się ODESŁAĆ z powrotem", async () => {
    // Bez prefiksu w ścieżce logicznej wołający odesłałby nazwę jako plik we WŁASNYM
    // biurku — czyli plik znikałby przy pierwszym kliknięciu.
    const [wpis] = await storage.list("anna", SHARED)
    expect(wpis!.path).toBe(`${SHARED}/cennik.csv`)
    expect(await storage.read("anna", wpis!.path)).toContain("audyt")
  })

  it("NIE myli się o zbieżność pierwszych liter", async () => {
    // „Wspólne plikiXYZ" to zwykły katalog w biurku i ma nim zostać.
    expect(isShared(`${SHARED}XYZ/tajne.txt`)).toBe(false)
    await storage.write("anna", `${SHARED}XYZ/moje.txt`, "prywatne")
    await expect(fs.stat(path.join(base, "biurka", "anna", `${SHARED}XYZ`, "moje.txt")))
      .resolves.toBeTruthy()
    // …i NIE pojawia się na wspólnej półce.
    const naPolce = await storage.list("robert", SHARED)
    expect(naPolce.map((f) => f.name)).not.toContain("moje.txt")
  })

  it("nie daje się opuścić w górę — i to jest ODMOWA, nie brak pliku", async () => {
    // Pierwsza wersja tego testu była zielona z niewłaściwego powodu: `path.resolve`
    // normalizuje `..`, plik docelowy nie istniał i `rejects.toThrow()` łapało ENOENT
    // zamiast odmowy. Cel MUSI więc istnieć naprawdę, a komunikat musi mówić o granicy.
    await storage.write("robert", `${MY_FILES}/lista-plac.csv`, "TAJNE WYNAGRODZENIA")
    await fs.writeFile(path.join(base, "sekret-poza-wszystkim.txt"), "spoza drzewa")

    for (const zla of [
      `${SHARED}/../biurka/robert/${MY_FILES}/lista-plac.csv`,
      `${MY_FILES}/../../robert/${MY_FILES}/lista-plac.csv`,
      "../robert/Moje pliki/lista-plac.csv",
      `${SHARED}/../sekret-poza-wszystkim.txt`,
      `${MY_FILES}/../../../sekret-poza-wszystkim.txt`,
    ]) {
      await expect(storage.read("anna", zla), zla).rejects.toThrow(/outside-desk/)
    }
  })

  it("cudze biurko dalej jest cudze", async () => {
    await storage.write("robert", `${MY_FILES}/prywatne.txt`, "tylko dla Roberta")
    const uAnny = await storage.list("anna", MY_FILES)
    expect(uAnny.map((f) => f.name)).not.toContain("prywatne.txt")
  })

  it("wchodzi do drzewa katalogów jako osobna gałąź", async () => {
    const drzewo = await storage.folders("anna")
    expect(drzewo).toContain(SHARED)
    expect(drzewo).toContain(MY_FILES)
  })
})

describe("Brama wspólnej półki", () => {
  const zeZdolnoscia = (...ids: string[]) => (id: string) => ids.includes(id)

  it("czytanie wymaga `shared.read`, pisanie `shared.write`", () => {
    const czytelnik = zeZdolnoscia("shared.read")
    expect(refuseShared(czytelnik, `${SHARED}/cennik.csv`, "read")).toBeNull()
    // TO JEST TA ASERCJA: sam wgląd NIE daje prawa do podmiany dokumentu, który czyta
    // cały zespół.
    expect(refuseShared(czytelnik, `${SHARED}/cennik.csv`, "write")).toContain("przełożony")
  })

  it("odmowa mówi, co zrobić dalej", () => {
    const nikt = zeZdolnoscia()
    const zdanie = refuseShared(nikt, SHARED, "read")
    expect(zdanie).toContain("przełożonego")
    // Ślepa odmowa produkuje agenta, który próbuje w kółko.
    expect(zdanie!.length).toBeGreaterThan(40)
  })

  it("nie ma nic do powiedzenia o WŁASNYM biurku", () => {
    // Kontrola negatywna: brama dotyczy wyłącznie wspólnej półki i nie może przy okazji
    // zacząć rządzić „Moimi plikami".
    const nikt = zeZdolnoscia()
    expect(refuseShared(nikt, `${MY_FILES}/faktura.csv`, "write")).toBeNull()
    expect(refuseShared(nikt, "Sprawy/abc/wynik.md", "read")).toBeNull()
  })
})
