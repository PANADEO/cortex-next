// Z DANYCH POWSTAJE PLIK — na żywym demonie, w środowisku „dokumenty".
//
// DLACZEGO POWSTAŁ. Na prośbę „utwórz mi z tego PDF" agent odpowiadał: „nie mam
// narzędzia generującego PDF, mogę zapisać treść jako dokument tekstowy". To była
// prawda i to był ślepy zaułek — piaskownica umiała wypisać tekst na wyjście i nic
// poza tym, bo (a) obraz nie miał czym złożyć dokumentu, (b) nikt nie zabierał
// z niej plików.
//
// Ten plik sprawdza obie połowy naraz i na PRAWDZIWEJ drodze: kod składa dokument
// i rysuje wykres, a pliki mają wylądować w teczce sprawy na biurku.
//
// Domyślnie POMIJANY — bez `DESK_SANDBOX_SOCKET` `pnpm test` zostaje zielony.
// Uruchomienie:
//   DESK_SANDBOX_SOCKET=/tmp/cx-sbx.sock DESK_DATA_DIR=/tmp/cx-desk \
//     npx vitest run packages/@cortex/desk-core/src/sandbox-documents.integration.test.ts

import { promises as fs } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as storage from "./desk-storage"
import * as sandbox from "./sandbox"

const SOCKET = process.env["DESK_SANDBOX_SOCKET"]
const WHO = "anna"
const CASE = "Sprawy/dokumenty-proba"

describe.skipIf(!SOCKET)("piaskownica wytwarza pliki, nie tylko tekst", () => {
  beforeAll(async () => {
    await storage.createFolder(WHO, CASE)
  })

  afterAll(async () => {
    const { target } = { target: await storage.fullPath(WHO, CASE) }
    await fs.rm(target, { recursive: true, force: true }).catch(() => {})
  })

  /** Uruchamia kod w środowisku „dokumenty" i zabiera to, co po nim zostało. */
  async function make(code: string) {
    const box = await sandbox.create({
      user: WHO,
      caseId: "dokumenty-proba",
      mounts: [],
      preset: "dokumenty",
    })
    try {
      const outcome = await box.exec(code)
      const got = await box.collect(CASE, outcome.produced)
      return { outcome, ...got }
    } finally {
      await box.dispose()
    }
  }

  it("pandoc składa dokument, a plik ląduje w teczce sprawy", async () => {
    const { outcome, kept, skipped } = await make(`
import subprocess, pathlib
pathlib.Path("pismo.md").write_text("# Zestawienie sierpnia\\n\\nRazem: 20 450,70 zł\\n", encoding="utf-8")
subprocess.run(["pandoc", "pismo.md", "-o", "pismo.docx"], check=True)
print("gotowe")
`)
    expect(outcome.ok, outcome.output).toBe(true)
    expect(skipped).toEqual([])
    expect(kept.map((one) => path.basename(one))).toContain("pismo.docx")
    // Rozmiar, nie sama nazwa: pusty plik o właściwej nazwie przeszedłby asercję wyżej,
    // a dokument, którego nie da się otworzyć, jest gorszy niż jego brak.
    const made = await storage.readBinary(WHO, `${CASE}/pismo.docx`)
    expect(made.length).toBeGreaterThan(2000)
    // DOCX to ZIP — pierwsze dwa bajty muszą to potwierdzać.
    expect(made.subarray(0, 2).toString("latin1")).toBe("PK")
  }, 120_000)

  it("PDF powstaje BEZ TeX Live — przez weasyprint", async () => {
    const { outcome, kept } = await make(`
import subprocess, pathlib
pathlib.Path("pismo.md").write_text("# Wniosek\\n\\nZażółć gęślą jaźń — 1 234,56 zł\\n", encoding="utf-8")
subprocess.run(["pandoc", "pismo.md", "--pdf-engine=weasyprint", "-o", "pismo.pdf"], check=True)
print("gotowe")
`)
    expect(outcome.ok, outcome.output).toBe(true)
    expect(kept.map((one) => path.basename(one))).toContain("pismo.pdf")
    const made = await storage.readBinary(WHO, `${CASE}/pismo.pdf`)
    expect(made.subarray(0, 4).toString("latin1")).toBe("%PDF")
  }, 180_000)

  it("wykres powstaje Z DANYCH, a nie z opisu", async () => {
    // To jest odpowiedź na pytanie, które unieważniło wcześniejszą propozycję A13:
    // „czym wykres zostanie narysowany". Matplotlib rysuje z LICZB, w odróżnieniu od
    // `generate_image`, które rysuje ilustrację ze zdania.
    const { outcome, kept } = await make(`
import matplotlib.pyplot as plt
plt.bar(["Usługi prawne", "Usługi IT", "Podróże"], [8500, 6100, 2536.9])
plt.title("Koszty sierpnia")
plt.tight_layout()
plt.savefig("wykres.png")
print("gotowe")
`)
    expect(outcome.ok, outcome.output).toBe(true)
    expect(kept.map((one) => path.basename(one))).toContain("wykres.png")
    const made = await storage.readBinary(WHO, `${CASE}/wykres.png`)
    // Podpis PNG — plik, który nie jest obrazem, ma tu polec.
    expect(made.subarray(1, 4).toString("latin1")).toBe("PNG")
  }, 120_000)

  it("plik wytworzony po BŁĘDZIE też jest zabierany", async () => {
    // Skrypt, który zapisał trzy arkusze z pięciu i przewrócił się na czwartym,
    // zostawił trzy PRAWDZIWE pliki. Wyrzucenie ich dlatego, że tura skończyła się
    // źle, byłoby karą za cudzy błąd.
    const { outcome, kept } = await make(`
import pathlib
pathlib.Path("polowa.csv").write_text("a,b\\n1,2\\n", encoding="utf-8")
raise SystemExit("celowa awaria")
`)
    expect(outcome.ok).toBe(false)
    expect(kept.map((one) => path.basename(one))).toContain("polowa.csv")
  }, 120_000)
})
