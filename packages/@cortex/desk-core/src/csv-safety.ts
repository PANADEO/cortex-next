/**
 * ARKUSZ, KTÓRY NIE WYKONA SIĘ PRZY OTWARCIU.
 *
 * DLACZEGO POWSTAŁ. `write_sheet` zapisywał napis od modelu dosłownie. Excel i LibreOffice
 * traktują komórkę zaczynającą się od `=`, `+`, `@` albo od tabulatora jako FORMUŁĘ
 * i wykonują ją przy otwarciu pliku — łącznie z `=cmd|'/c calc'!A0` i z `=HYPERLINK(...)`,
 * który wyciąga treść sąsiednich komórek pod obcy adres.
 *
 * Ciąg taki nie musi pochodzić od napastnika po drugiej stronie: wystarczy, że siedzi
 * w pliku źródłowym klienta, a model przepisze go do zestawienia w dobrej wierze. Skutek
 * jest wtedy najgorszy z możliwych — plik WYTWORZONY PRZEZ BIURKO atakuje komputer pani
 * Basi, i nosi przy tym naszą plakietkę „sprawdzony po zapisie".
 *
 * NAJWAŻNIEJSZA DECYZJA W TYM PLIKU: liczba ujemna NIE jest formułą.
 *
 * Powszechna rada każe uciekać wszystko, co zaczyna się od `-`. W produkcie księgowym
 * to jest lekarstwo gorsze od choroby: `-1234,56` to zwykła korekta, a po ucieczce
 * przestaje być liczbą i arkusz przestaje sumować. Uciekamy więc `-` wyłącznie wtedy,
 * gdy to, co za nim stoi, nie jest liczbą.
 *
 * Czysty moduł, bez bazy i bez dysku — żeby dało się go sprawdzić bez wołania modelu.
 */

/** Znaki, od których arkusz rozpoznaje formułę. */
const FORMULA_START = new Set(["=", "+", "@", "\t"])

/** `-12`, `-1234,56`, `-1 234,56`, `-1.234,56` — to są liczby, nie formuły. */
const NEGATIVE_NUMBER = /^-\s?\d[\d\s.,]*$/

function dangerous(value: string): boolean {
  const first = value[0]
  if (first === undefined) return false
  if (FORMULA_START.has(first)) return true
  return first === "-" && !NEGATIVE_NUMBER.test(value)
}

export type SafeCsv = { csv: string; neutralised: number }

/**
 * Przechodzi przez CSV z poszanowaniem cudzysłowów i neutralizuje komórki, które arkusz
 * wziąłby za formułę. Wszystko pozostałe zostaje bajt w bajt — to ma być ten sam plik,
 * a nie plik przepisany.
 *
 * Apostrof z przodu każe arkuszowi potraktować komórkę jako tekst i nie jest widoczny
 * w samej komórce. Cudzysłów wokół wartości NIE wystarcza — arkusz zdejmuje go przy
 * wczytaniu i formuła wykonuje się tak samo, więc komórki w cudzysłowach sprawdzamy tak
 * samo jak gołe.
 */
export function safeCsv(text: string): SafeCsv {
  let out = ""
  let field = ""
  let quoted = false
  let inQuotes = false
  let neutralised = 0

  const flush = () => {
    const risky = dangerous(field)
    if (risky) neutralised++
    const value = risky ? `'${field}` : field
    out += quoted ? `"${value}"` : value
    field = ""
    quoted = false
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '""'
        i++
        continue
      }
      if (c === '"') {
        inQuotes = false
        continue
      }
      field += c
      continue
    }
    if (c === '"' && field === "") {
      inQuotes = true
      quoted = true
      continue
    }
    // Separator kolumny: przecinek albo średnik. Średnik, bo polski Excel zapisuje nim.
    if (c === "," || c === ";") {
      flush()
      out += c
      continue
    }
    // Koniec wiersza obsługujemy razem z `\r`, żeby CRLF nie zostawiał pustej komórki
    // złożonej z samego `\r` — ta po ucieczce zamieniłaby pusty wiersz w apostrof.
    if (c === "\r" && text[i + 1] === "\n") {
      flush()
      out += "\r\n"
      i++
      continue
    }
    if (c === "\n") {
      flush()
      out += c
      continue
    }
    field += c
  }
  flush()
  return { csv: out, neutralised }
}
