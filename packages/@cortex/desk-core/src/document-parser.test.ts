// Klient usługi rozpoznawania dokumentów — wszystko, co da się sprawdzić BEZ usługi.
//
// DLACZEGO POWSTAŁ. Ta czynność ma jedną własność, której nie widać w kodzie i którą
// najłatwiej zgubić przy pierwszej poprawce: OBCIĘCIE MUSI BYĆ WIDOCZNE. Usługa
// przetwarza najwyżej `MAX_PAGES` stron i o pominiętych mówi jednym polem `truncated`,
// po czym oddaje markdown wyglądający na kompletny. Wynik obcięty, nieodróżnialny od
// całego, zdarzył się w tym produkcie już przy odczycie pliku i przy wyjściu z piaskownicy;
// tutaj byłby trzeci raz i dlatego ma tu własne asercje, a nie jedną wzmiankę na końcu.
//
// Druga rzecz sprawdzana tutaj: żadna droga wyjścia z tej funkcji nie może udać sukcesu.
// `done` z pustą treścią, zgubione zadanie, przekroczony termin — wszystkie mają rzucić,
// bo krok narzędzia zamienia wyjątek na uczciwe „nie udało się", a cichy sukces
// zamieniłby go w dowód poświadczający odczyt, którego nie było.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DocumentParserFailure,
  documentParserUrl,
  isRecognisable,
  recogniseDocument,
  recognitionAnswer,
  recognitionSummary,
} from "./document-parser"

type Job = {
  status: "processing" | "done" | "error"
  markdown?: string | null
  error_message?: string | null
  page_count?: number
  image_count?: number
  truncated?: boolean
  model?: string | null
}

/** Usługa udawana odpowiedziami HTTP, nie podmienioną funkcją — droga jest ta sama. */
function fakeService(plan: {
  create?: { status: number; body?: unknown }
  poll: ({ status: number; body?: Job } | "network-down")[]
}) {
  const calls: string[] = []
  let index = 0
  const answer = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

  const stub = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const address = String(url)
    calls.push(`${init?.method ?? "GET"} ${address}`)
    if (address.endsWith("/jobs") && init?.method === "POST") {
      const c = plan.create ?? { status: 202, body: { job_id: "j1", status: "processing" } }
      return answer(c.status, c.body ?? "")
    }
    const next = plan.poll[Math.min(index, plan.poll.length - 1)]
    index += 1
    if (next === "network-down") throw new TypeError("fetch failed")
    return answer(next!.status, next!.body ?? "")
  })
  vi.stubGlobal("fetch", stub)
  return { calls }
}

const quickly = { pollEveryMs: 0, deadlineMs: 5_000 }
const file = { fileName: "faktura.pdf", bytes: Buffer.from("%PDF-1.4 udawany"), user: "anna" }

describe("adres usługi", () => {
  const before = process.env.DOCUMENT_PARSER_BACKEND_URL

  afterEach(() => {
    if (before === undefined) delete process.env.DOCUMENT_PARSER_BACKEND_URL
    else process.env.DOCUMENT_PARSER_BACKEND_URL = before
  })

  it("ma sensowną domyślną — nazwę usługi w sieci compose", () => {
    delete process.env.DOCUMENT_PARSER_BACKEND_URL
    expect(documentParserUrl()).toBe("http://document-parser-backend:8000")
  })

  it("zmienna środowiskowa wygrywa, a końcowy ukośnik nie robi podwójnego", () => {
    process.env.DOCUMENT_PARSER_BACKEND_URL = "http://localhost:8010/"
    expect(documentParserUrl()).toBe("http://localhost:8010")
  })

  it("pusty napis to NIE jest wartość — compose wstawia go za nieustawioną zmienną", () => {
    // `VAR: ${VAR:-}` w compose dociera tu jako "". Bez tego warunku Biurko wołałoby
    // adres pusty i dostawało błąd sieci zamiast działającej domyślnej.
    process.env.DOCUMENT_PARSER_BACKEND_URL = "   "
    expect(documentParserUrl()).toBe("http://document-parser-backend:8000")
  })
})

describe("co w ogóle warto rozpoznawać", () => {
  it("dokument nieczytelny bajtami — tak", () => {
    for (const p of ["Moje pliki/faktura.pdf", "a/b/skan.JPG", "umowa.docx", "zestawienie.xlsx"]) {
      expect(isRecognisable(p), p).toBe(true)
    }
  })

  it("plik tekstowy — NIE, bo `read_file` czyta go dosłownie i za darmo", () => {
    // Puszczenie CSV tędy zamieniłoby pewny odczyt w domysł modelu i jeszcze policzyłoby
    // za to pieniądze. To jest cała różnica między tą listą a listą kafelka IDP.
    for (const p of ["faktury-08.csv", "notatka.txt", "raport.md"]) {
      expect(isRecognisable(p), p).toBe(false)
    }
  })

  it("archiwum i program — NIE", () => {
    expect(isRecognisable("paczka.zip")).toBe(false)
    expect(isRecognisable("bez-rozszerzenia")).toBe(false)
  })
})

describe("rozpoznanie dokumentu", () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it("czeka na wynik i oddaje treść razem z liczbą stron", async () => {
    const { calls } = fakeService({
      poll: [
        { status: 200, body: { status: "processing" } },
        {
          status: 200,
          body: {
            status: "done",
            markdown: "# Faktura FV/2026/08/117\nDo zapłaty: 4 672,77 zł",
            page_count: 1,
            image_count: 1,
            truncated: false,
            model: "google/gemini-2.5-flash-lite",
          },
        },
      ],
    })

    const r = await recogniseDocument(file, quickly)
    expect(r.markdown).toContain("4 672,77")
    expect(r.pages).toBe(1)
    expect(r.truncated).toBe(false)
    // Zadanie zakłada się RAZ, a odpytuje tyle razy, ile trzeba.
    expect(calls.filter((c) => c.startsWith("POST"))).toHaveLength(1)
    expect(calls.filter((c) => c.startsWith("GET"))).toHaveLength(2)
  })

  it("osoba jedzie do usługi, bo rejestr cortex-proxy ma widzieć człowieka, nie usługę", async () => {
    let sent: FormData | null = null
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (String(url).endsWith("/jobs") && init?.method === "POST") {
          sent = init.body as FormData
          return new Response(JSON.stringify({ job_id: "j1", status: "processing" }), {
            status: 202,
          })
        }
        return new Response(
          JSON.stringify({ status: "done", markdown: "x", page_count: 1, image_count: 1 }),
          { status: 200 },
        )
      }),
    )
    await recogniseDocument(file, quickly)
    expect(sent).not.toBeNull()
    expect((sent as unknown as FormData).get("user_email")).toBe("anna")
  })

  it("OBCIĘCIE dojeżdża w wyniku, a nie ginie po drodze", async () => {
    fakeService({
      poll: [
        {
          status: 200,
          body: {
            status: "done",
            markdown: "początek długiego dokumentu",
            page_count: 34,
            image_count: 20,
            truncated: true,
          },
        },
      ],
    })
    const r = await recogniseDocument(file, quickly)
    expect(r.truncated).toBe(true)
    expect(r.pages).toBe(34)
    expect(r.recognisedPages).toBe(20)
  })

  it("„gotowe” bez treści to nie sukces", async () => {
    // Bez tej gałęzi dowód poświadczyłby odczyt dokumentu, z którego do sprawy
    // nie weszło ani jedno zdanie.
    fakeService({ poll: [{ status: 200, body: { status: "done", markdown: "   " } }] })
    await expect(recogniseDocument(file, quickly)).rejects.toThrow(DocumentParserFailure)
  })

  it("błąd usługi niesie POWÓD, a nie samo „nie wyszło”", async () => {
    fakeService({
      poll: [
        {
          status: 200,
          body: { status: "error", error_message: "No vision model resolved — set DOCUMENT_..." },
        },
      ],
    })
    await expect(recogniseDocument(file, quickly)).rejects.toThrow(/No vision model resolved/)
  })

  it("zgubione zadanie mówi, że zostało zgubione — to nie jest przejściowa awaria sieci", async () => {
    fakeService({ poll: [{ status: 404 }] })
    await expect(recogniseDocument(file, quickly)).rejects.toThrow(/zgubił/)
  })

  it("zerwane połączenie kończy się naszym błędem, a nie surowym wyjątkiem `fetch`", async () => {
    fakeService({ poll: ["network-down"] })
    await expect(recogniseDocument(file, quickly)).rejects.toThrow(DocumentParserFailure)
  })

  it("odmowa przy zakładaniu zadania nie wchodzi w pętlę odpytywania", async () => {
    const { calls } = fakeService({ create: { status: 413, body: "file exceeds MAX_UPLOAD_MB" }, poll: [] })
    await expect(recogniseDocument(file, quickly)).rejects.toThrow(/MAX_UPLOAD_MB/)
    expect(calls.filter((c) => c.startsWith("GET"))).toHaveLength(0)
  })

  it("TERMIN istnieje — inaczej krok narzędzia wisiałby tyle, ile trwa awaria", async () => {
    // Para `tool_start`/`tool_end` ma się domknąć ZAWSZE. Usługa, która odpowiada
    // „przetwarzam" bez końca, jest dokładnie tym przypadkiem, w którym nie ma
    // kto tej pary domknąć, jeśli pętla nie ma własnego terminu.
    fakeService({ poll: [{ status: 200, body: { status: "processing" } }] })
    await expect(
      recogniseDocument(file, { pollEveryMs: 1, deadlineMs: 30 }),
    ).rejects.toThrow(/zbyt długo/)
  })
})

describe("podsumowanie kroku", () => {
  it("mówi, ile stron weszło — z polską odmianą, bo czyta to człowiek", () => {
    expect(recognitionSummary({ pages: 1, recognisedPages: 1, truncated: false })).toBe("1 strona")
    expect(recognitionSummary({ pages: 3, recognisedPages: 3, truncated: false })).toBe("3 strony")
    expect(recognitionSummary({ pages: 12, recognisedPages: 12, truncated: false })).toBe(
      "12 stron",
    )
    expect(recognitionSummary({ pages: 22, recognisedPages: 22, truncated: false })).toBe(
      "22 strony",
    )
  })

  it("OBCIĘCIE JEST WIDOCZNE — liczba przetworzonych i liczba wszystkich stron", () => {
    // To jest asercja, dla której ten plik powstał. Bez niej dowód mówi „rozpoznano
    // umowa.pdf — 34 strony" o dokumencie, z którego model widział dwadzieścia.
    const s = recognitionSummary({ pages: 34, recognisedPages: 20, truncated: true })
    expect(s).toContain("20")
    expect(s).toContain("34")
    expect(s).toMatch(/dalszych nie odczytano/)
  })

  it("obcięcie widać także wtedy, gdy usługa nie postawi flagi, a liczby się nie zgadzają", () => {
    // Dwa niezależne sygnały tej samej rzeczy. Poleganie wyłącznie na fladze znaczyłoby,
    // że jedno pole po stronie usługi decyduje o prawdziwości całego dowodu.
    expect(recognitionSummary({ pages: 9, recognisedPages: 4, truncated: false })).toContain(
      "4 z 9",
    )
  })
})

describe("odpowiedź dla modelu", () => {
  const recognised = {
    markdown: "Do zapłaty: 4 672,77 zł",
    pages: 1,
    recognisedPages: 1,
    truncated: false,
    model: null,
  }

  it("mówi modelowi, CZYM jest ta treść, zanim poda treść", () => {
    // Model, który dostanie sam markdown, napisze potem „w pliku jest kwota…" z pewnością
    // należną odczytowi bajtów — a to była odpowiedź innego modelu na obrazek.
    const a = recognitionAnswer("faktura.pdf", recognised)
    expect(a).toMatch(/ROZPOZNANIA/)
    expect(a.indexOf("ROZPOZNANIA")).toBeLessThan(a.indexOf("4 672,77"))
    expect(a).toContain("4 672,77")
  })

  it("przy obcięciu mówi wprost, że reszty tam nie ma", () => {
    const a = recognitionAnswer("umowa.pdf", {
      ...recognised,
      pages: 34,
      recognisedPages: 20,
      truncated: true,
    })
    expect(a).toContain("34")
    expect(a).toContain("20")
    expect(a).toMatch(/nie twierdź, że znasz całość/)
  })

  it("bez obcięcia nie dokleja ostrzeżenia, którego nie ma o czym mówić", () => {
    expect(recognitionAnswer("faktura.pdf", recognised)).not.toMatch(/nie twierdź/)
  })
})
