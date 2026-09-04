// PLIK SKASOWANY ZE WSPÓLNEJ PÓŁKI MA TRAFIĆ DO KOSZA, KTÓRY KTOKOLWIEK WIDZI.
//
// DLACZEGO POWSTAŁ. `toTrash` brało korzeń kosza z pliku ŹRÓDŁOWEGO, więc firmowy wzór
// pisma szedł do `wspolne/.trash`. Tam nie zagląda nikt: `trash()`, `restore()`
// i `emptyTrash()` pytają o kosz OSOBY. Plik znikał z półki i nie pokazywał się nigdzie —
// nie do odzyskania, nie do skasowania, rosnący bez końca. Cicha zbiornica dokumentów.
//
// Że to była pomyłka, a nie decyzja, widać po sąsiednim kodzie: komentarz przy
// `restoreTarget` opisuje wprost „osobę, której odebrano `shared.write` po wyrzuceniu
// firmowego wzoru pisma DO WŁASNEGO KOSZA" — czyli zakłada dokładnie ten kształt,
// którego `toTrash` nie robiło.
//
// Ta klasa błędu nie daje ŻADNEGO objawu: kasowanie działa, ekran półki się odświeża,
// plik posłusznie znika. Widać ją wyłącznie pytaniem „a gdzie on teraz jest".

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let dataDir = ""
let storage: typeof import("./desk-storage")

const WHO = "anna"
const SHELF = "Wspólne pliki"

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "desk-shelf-trash-"))
  process.env["DESK_DATA_DIR"] = dataDir
  vi.resetModules()
  storage = await import("./desk-storage")
  await storage.prepareDesk(WHO)
  await storage.createFolder(WHO, SHELF)
  await storage.write(WHO, `${SHELF}/wzor-pisma.txt`, "Szanowni Państwo,\n")
  await storage.write(WHO, "Moje pliki/moja-notatka.txt", "moje\n")
})

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {})
})

describe("kosz obejmuje wspólną półkę", () => {
  it("plik z półki JEST w koszu i wie, skąd zniknął", async () => {
    await storage.toTrash(WHO, `${SHELF}/wzor-pisma.txt`)
    const bin = await storage.trash(WHO)
    expect(bin.map((z) => z.name)).toEqual(["wzor-pisma.txt"])
    // Bez folderu źródłowego człowiek widzi nazwę pliku i nie wie, czy odzyskanie
    // odłoży go na półkę firmy, czy wrzuci do jego własnych plików.
    expect(bin[0]?.fromFolder).toBe(SHELF)
  })

  it("odzyskanie odkłada go NA PÓŁKĘ, nie do Moich plików", async () => {
    const id = await storage.toTrash(WHO, `${SHELF}/wzor-pisma.txt`)
    const back = await storage.restore(WHO, id)
    expect(back.landedElsewhere).toBe(false)
    expect(await storage.read(WHO, `${SHELF}/wzor-pisma.txt`)).toContain("Szanowni")
    expect(await storage.trash(WHO)).toEqual([])
  })

  it("opróżnienie kosza NAPRAWDĘ go usuwa", async () => {
    // To jest ta połowa, przez którą kosz półki był zbiornicą bez dna: nawet gdyby
    // ktoś go zobaczył, nie miał czym go opróżnić.
    await storage.toTrash(WHO, `${SHELF}/wzor-pisma.txt`)
    expect(await storage.emptyTrash(WHO)).toBe(1)
    expect(await storage.trash(WHO)).toEqual([])
  })

  it("nie zostawia po sobie kosza NA PÓŁCE — to jest miejsce, którego nikt nie sprząta", async () => {
    // Kontrola bezpośrednia na dysku, a nie przez to samo API, które sprawdzamy wyżej.
    // Gdyby plik szedł do `wspolne/.trash`, trzy testy wyżej i tak by przeszły w dniu,
    // w którym ktoś dopisze czytanie tamtego katalogu — a problem zostanie.
    await storage.toTrash(WHO, `${SHELF}/wzor-pisma.txt`)
    await expect(fs.readdir(path.join(dataDir, "wspolne", ".trash"))).rejects.toThrow()
    const mine = await fs.readdir(path.join(dataDir, "biurka", WHO, ".trash"))
    expect(mine).toHaveLength(1)
  })

  it("KONTROLA UJEMNA: plik z własnego biurka nadal chodzi tą samą drogą", async () => {
    const id = await storage.toTrash(WHO, "Moje pliki/moja-notatka.txt")
    expect((await storage.trash(WHO)).map((z) => z.fromFolder)).toEqual(["Moje pliki"])
    await storage.restore(WHO, id)
    expect(await storage.read(WHO, "Moje pliki/moja-notatka.txt")).toContain("moje")
  })

  it("KONTROLA UJEMNA: kosze dwóch osób są osobne", async () => {
    // Kosz jest teraz „zawsze własny", więc warto sprawdzić, że „własny" znaczy naprawdę
    // czyjś, a nie wspólny worek pod inną nazwą.
    await storage.prepareDesk("robert")
    await storage.toTrash(WHO, `${SHELF}/wzor-pisma.txt`)
    expect(await storage.trash("robert")).toEqual([])
    expect(await storage.trash(WHO)).toHaveLength(1)
  })
})
