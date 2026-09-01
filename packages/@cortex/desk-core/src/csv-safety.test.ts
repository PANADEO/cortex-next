// Arkusz wytworzony przez Biurko nie wykonuje się przy otwarciu.
//
// Znalezione przy przeglądzie konkurencji: `write_sheet` zapisywał napis od modelu
// dosłownie, a Excel wykonuje komórkę zaczynającą się od `=`. Ciąg taki nie musi
// pochodzić od napastnika — wystarczy, że siedzi w pliku źródłowym klienta, a model
// przepisze go do zestawienia. Plik z naszą plakietką „sprawdzony po zapisie" atakował
// wtedy komputer pani Basi.

import { describe, expect, it } from "vitest"
import { safeCsv } from "./csv-safety"

const csv = (s: string) => safeCsv(s).csv

describe("CSV, który nie wykona się w arkuszu", () => {
  it("neutralizuje cztery znaki, od których arkusz rozpoznaje formułę", () => {
    for (const payload of ["=cmd|'/c calc'!A0", "+1+1", "@SUM(A1)", "\tzło"]) {
      const { csv: out, neutralised } = safeCsv(`nazwa,wartosc\nFirma,${payload}`)
      expect(out, payload).toContain(`'${payload}`)
      expect(neutralised, payload).toBe(1)
    }
  })

  it("NIE psuje liczb ujemnych — to jest produkt księgowy", () => {
    // Powszechna rada każe uciekać wszystko od `-`. Tutaj to zamieniłoby korektę
    // w tekst i arkusz przestałby sumować, więc byłoby lekarstwem gorszym od choroby.
    const out = safeCsv("nazwa,kwota\nKorekta,-1234,56\nRabat,-1 234\nUjemne,-12")
    expect(out.csv).not.toContain("'-")
    expect(out.neutralised).toBe(0)
  })

  it("ucieka minus, za którym nie stoi liczba", () => {
    expect(csv("a\n-1+1")).toContain("'-1+1")
    expect(csv("a\n--nazwa")).toContain("'--nazwa")
  })

  it("widzi formułę także wewnątrz cudzysłowów", () => {
    // Cudzysłów NIE jest ochroną: arkusz zdejmuje go przy wczytaniu i wykonuje formułę.
    const out = csv('nazwa,wzor\nFirma,"=1+1"')
    expect(out).toContain(`"'=1+1"`)
  })

  it("nie rusza niczego, co formułą nie jest", () => {
    // Najważniejsza kontrola negatywna: to ma być TEN SAM plik, nie plik przepisany.
    for (const source of [
      "nr,kontrahent,netto,vat,data\nFV/1/2026,Firma A,100.50,23,2026-01-15\n",
      'nazwa;kwota\r\n"Firma, z przecinkiem";1500,00\r\n',
      'cytat\n"on powiedział ""tak"""\n',
      "a,b\n\n,\n",
    ]) {
      expect(csv(source), source).toBe(source)
    }
  })

  it("liczy, ile komórek trzeba było zneutralizować", () => {
    // Liczba idzie do dowodu sprawy — pani Basia ma wiedzieć, że plik został ruszony.
    expect(safeCsv("a,b\n=1,=2\nx,y").neutralised).toBe(2)
  })

  it("średnik też jest separatorem, bo polski Excel nim zapisuje", () => {
    expect(csv("a;b\nx;=1+1")).toContain("'=1+1")
  })
})
