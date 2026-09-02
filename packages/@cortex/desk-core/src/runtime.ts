import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import * as audit from "./audit-log"
import { hasCapability } from "./capability-gate"
import { safeCsv } from "./csv-safety"
import { migrate, pool } from "./db"
import * as storage from "./desk-storage"
import { isInfrastructure, readableFailure } from "./failure"
import { mcpTools } from "./mcp/client"
import * as memory from "./memory"
import * as sandbox from "./sandbox"
import { beginTurn, endTurn, wasAborted } from "./turn-control"
import type { DeskEvent, Policy, User } from "./types"

/**
 * F4 · RUNTIME AGENTA — jedyne miejsce w kodzie, które zna bibliotekę agentową.
 * Na zewnątrz wychodzi wyłącznie nasz `DeskEvent`.
 */

/**
 * Sufit długości JEDNEJ odpowiedzi modelu.
 *
 * Bez niego dostawca podstawia maksimum modelu (dla Sonneta 4.5 — 64 000 tokenów)
 * i REZERWUJE tyle na poczet limitu klucza. Klucz z ustawionym pułapem odbijał
 * przez to każdą turę zdaniem „requires more credits, or fewer max_tokens",
 * które nasza mapa błędów tłumaczyła na „skończyły się środki" — komunikat
 * prawdziwy w słowach i mylący co do przyczyny: środki były, brakowało miejsca
 * na rezerwację.
 *
 * Osobno od diagnostyki to po prostu brakująca krawędź: biurko rozlicza pracę
 * dziennym limitem na osobę, a tura bez sufitu mogła wypisać jednym ciągiem
 * kilkanaście razy więcej, niż ten limit przewiduje. 8000 tokenów to około
 * dwudziestu stron tekstu — więcej, niż potrzebuje którykolwiek dokument,
 * jaki biurko dziś wytwarza.
 */
const OUTPUT_CEILING = Number(process.env.DESK_OUTPUT_CEILING ?? 8000)

export async function appendEvent(caseId: string, e: DeskEvent) {
  await pool.query(`insert into desk.event (case_id, payload) values ($1,$2)`, [
    caseId,
    JSON.stringify(e),
  ])
}

/**
 * Wyciąga PRAWDZIWY koszt z odpowiedzi cortex-proxy.
 *
 * Proxy oddaje go w `usage.cost` — to pole spoza standardu OpenAI, więc SDK
 * wyrzuca je przy parsowaniu i do `generateText` nie dociera nic. Bez tego
 * ekstraktora biurko liczyło pracę stawkami wpisanymi w kod, a dzienny limit
 * pracownika — jedyna twarda granica wydatków w tym produkcie — pilnował
 * SZACUNKU, nie pieniędzy, które firma naprawdę płaci. Sprawdzone
 * doświadczalnie: po podmianie stawek zapasowych na absurdalne zapisany koszt
 * poszedł za nimi, czyli prawdziwa liczba nigdy nie była używana.
 *
 * Klucz `cortex-proxy` jest ten sam, po który sięga `turnCost`.
 */
const costFromProxy = {
  extractMetadata: async ({ parsedBody }: { parsedBody: unknown }) => {
    const cost = (parsedBody as { usage?: { cost?: unknown } })?.usage?.cost
    return typeof cost === "number" ? { "cortex-proxy": { cost } } : undefined
  },
  createStreamExtractor: () => {
    let cost: number | undefined
    return {
      processChunk(chunk: unknown) {
        const c = (chunk as { usage?: { cost?: unknown } })?.usage?.cost
        // strumień oddaje `usage` w ostatnim kawałku; sumujemy na wypadek, gdyby oddał więcej
        if (typeof c === "number") cost = (cost ?? 0) + c
      },
      buildMetadata: () => (cost === undefined ? undefined : { "cortex-proxy": { cost } }),
    }
  },
}

function model(user: string) {
  const provider = createOpenAICompatible({
    name: "cortex-proxy",
    baseURL: process.env.CORTEX_PROXY_URL!,
    // rejestr cortex-proxy to księga, do której sięgnie audytor — musi widzieć osobę, nie aplikację
    headers: { "X-User-ID": user },
    metadataExtractor: costFromProxy,
  })
  return provider(process.env.DESK_MODEL!)
}

const SYSTEM = `Jesteś asystentem przy biurku pracownika polskiej firmy. Pomagasz w pracy — odpowiadasz na pytania, tłumaczysz, liczysz, piszesz, doradzasz — a do tego masz narzędzia, którymi sięgasz po pliki tej osoby i tworzysz dokumenty.

JAK ROZMAWIASZ
- Po polsku, krótko i konkretnie. Odbiorcą jest osoba nietechniczna: żadnego żargonu, żadnych nazw narzędzi w odpowiedzi.
- Nie używasz form, które zdradzają płeć („zrobiłem"/„zrobiłam"). Piszesz bezosobowo: „Gotowe", „Zapisane w teczce sprawy", „Wychodzi 20 450,70 zł".
- Zwykłe pytanie zasługuje na zwykłą odpowiedź. Jeśli ktoś pyta o rzecz spoza jego plików, po prostu odpowiadasz z własnej wiedzy — tak samo jak zrobiłby to kolega z biurka obok. NIE odsyłasz z kwitkiem tylko dlatego, że pytanie nie dotyczy dokumentów.
- Gdy czegoś nie wiesz albo Twoja wiedza mogła się zdezaktualizować, mówisz to wprost i podajesz, czego jesteś pewny, a czego nie.

CZEGO NIE ROBISZ NIGDY
- Nie zmyślasz liczb, dat, kwot ani treści dokumentów. W robocie na plikach klienta pomyłka kosztuje — lepiej powiedzieć „tego nie ma w pliku" niż zgadnąć.
- Nie twierdzisz, że coś sprawdziłeś, przeczytałeś albo zapisałeś, jeśli nie wywołałeś narzędzia. Człowiek widzi listę Twoich czynności i zobaczy rozbieżność.
- Nie wymieniasz z nazwy pliku, którego w tej turze nie stworzyłeś narzędziem. Aplikacja zestawia Twoją odpowiedź z listą czynności i sama dopisuje pod nią ostrzeżenie, gdy takiego pliku nie ma — obejść się tego nie da, a jedno zmyślone zdanie podważa wszystko inne, co napisałeś.

PRACA NA PLIKACH
- Zanim policzysz cokolwiek z pliku, przeczytaj go narzędziem. Nie zgaduj zawartości z nazwy.
- Gotową robotę zapisujesz narzędziem, nie wklejasz długiego dokumentu do rozmowy. Krótką odpowiedź (kilka zdań, jedna liczba, wyjaśnienie) mówisz normalnie w rozmowie — nie robisz z niej pliku.
- Po zapisaniu dokumentu odczytaj go narzędziem sprawdzającym i napisz, co w nim faktycznie jest.
- Pliki, które tworzysz, trafiają do teczki tej sprawy. Do trwałych „Moich plików" przenosisz coś WYŁĄCZNIE wtedy, gdy człowiek o to poprosi.
- ZAWSZE, gdy nie możesz zrobić tego, o co proszą — bo nie masz odpowiedniej czynności ALBO bo takiej możliwości tu w ogóle nie ma (poczta, cudze systemy, internet) — NAJPIERW zgłoś to narzędziem report_gap z krótkim opisem tego, czego było trzeba, a dopiero potem odpowiedz. Ta informacja idzie do osoby, która może to zmienić; bez zgłoszenia nikt się nie dowie, że czegoś brakuje.
- Jeśli czegoś nie da się zrobić dostępnymi narzędziami, powiedz to wprost, wyjaśnij dlaczego i zaproponuj drogę naokoło.`

/**
 * Wynik jednego kroku narzędzia: co zobaczy CZŁOWIEK (`summary` w dowodzie)
 * i co dostanie MODEL (`answer`). To są dwie różne rzeczy i dlatego są dwoma polami —
 * dowód ma być krótki i sprawdzalny, odpowiedź dla modelu bywa całym plikiem.
 */
type StepResult = { ok?: boolean; summary: string; answer: string }

export function toolsForPolicy(u: User, p: Policy, caseId: string) {
  const caseFolder = storage.caseFolder(u.id, caseId)
  const emit = (e: DeskEvent) => appendEvent(caseId, e)

  /**
   * JEDYNA droga, którą narzędzie zapisuje swój krok.
   *
   * Powstało po zmierzeniu, że sześć z dziesięciu narzędzi nie miało `try/catch`:
   * wyjątek w środku (brak pliku, padnięta piaskownica, zerwane połączenie) gubił
   * `tool_end`, więc krok zostawał na ekranie jako „w toku” NA ZAWSZE, a
   * `evidenceFromEvents` pomijało go w dowodzie, bo bierze wyłącznie pary ze statusem.
   * Produkt, którego jedynym argumentem jest dowód, przestawał dowodzić po cichu.
   *
   * Zamknięcie jest STRUKTURALNE, nie polega na dopisaniu `try` w dziesięciu miejscach:
   * `tool_end` leci z `finally` opakowywacza, więc narzędzie dopisane za rok nie ma
   * gdzie o nim zapomnieć. To ten sam kształt, co `defer` sprzątający katalog sprawy
   * w demonie piaskownicy.
   */
  const step = async (
    name: string,
    label: string,
    args: Record<string, unknown>,
    body: () => Promise<StepResult>,
  ): Promise<string> => {
    const start = Date.now()
    const id = randomUUID()
    await emit({ type: "tool_start", id, name, label, args })
    let end = { ok: false, summary: "przerwane" }
    let answer = "Czynność nie doszła do skutku."
    try {
      const r = await body()
      end = { ok: r.ok !== false, summary: r.summary }
      answer = r.answer
    } catch (e) {
      // Dowód mówi, że się NIE udało, a model dostaje zdanie, z którym da się coś zrobić.
      // Surowa treść wyjątku nie idzie ani na ekran, ani do modelu w całości — bywa w niej
      // ścieżka z serwera albo klucz z nagłówka.
      end = { ok: false, summary: "czynność się nie powiodła" }
      answer = `Nie udało się wykonać tej czynności. ${String(e).slice(0, 160)}`
    } finally {
      await emit({ type: "tool_end", id, name, ...end, ms: Date.now() - start })
    }
    return answer
  }
  // `ToolSet` z `ai`, nie `Record<string, any>`: to jest dokładnie ten worek, który
  // `generateText` przyjmuje, więc niezgodność kształtu narzędzia wychodzi tutaj,
  // a nie dopiero jako odmowa dostawcy w środku tury.
  const t: ToolSet = {}

  // FILTR NA ODKRYCIU: rejestrujemy wyłącznie przyznane.
  // Model nie widzi narzędzia, którego rola nie dostała — nie ma czego odmawiać.

  /**
   * Rejestrowane ZAWSZE, dla każdej roli. Model nie zna listy zablokowanych zdolności
   * i nie może jej poznać — opisuje własnymi słowami, czego mu zabrakło, a dopasowanie
   * do katalogu robimy tutaj. Dzięki temu kłódka na ekranie pochodzi z CZYNNOŚCI agenta,
   * a nie z naszego domysłu o treści polecenia.
   */
  t.report_gap = tool({
    description:
      "Zgłasza, że do wykonania zlecenia zabrakło Ci czynności, której nie masz. " +
      "Wywołaj to ZANIM napiszesz odpowiedź, a potem powiedz człowiekowi, co zrobiłeś zamiast tego.",
    inputSchema: z.object({
      whatINeeded: z.string().describe('krótko, po polsku, np. „zapisać to jako arkusz Excela"'),
    }),
    execute: async ({ whatINeeded }) => {
      const hit = matchCapability(whatINeeded, p.blocked)
      await emit({
        type: "blocked",
        description: whatINeeded,
        // Bez `name`: zdarzenie niesie TOŻSAMOŚĆ zdolności, a nazwę dobiera ekran
        // w swoim języku. Nazwa zapisana przy zdarzeniu zamroziłaby polszczyznę
        // w historii sprawy, której nikt już potem nie przetłumaczy.
        ...(hit ? { capabilityId: hit.id, department: hit.department } : {}),
      })
      await audit.write(u.id, "capability.missing", {
        caseId,
        description: whatINeeded,
        capability: hit?.id,
      })
      // Nazwy działu w tym zdaniu NIE MA celowo: `hit.department` to dziś wartość
      // (`accounting`), a jej nazwę zna słownik ekranu, nie ten kod. Człowiek widzi
      // dział przy prośbie o dostęp, w swoim języku — model nie musi go powtarzać.
      return hit
        ? "Odnotowane. Tej czynności nie masz włączonej — zgodę wydaje dział, który za nią odpowiada. Człowiek zobaczył prośbę o dostęp; zrób teraz to, co da się zrobić bez niej."
        : "Odnotowane. Powiedz człowiekowi wprost, czego nie da się zrobić, i zaproponuj drogę naokoło."
    },
  })

  if (hasCapability(p, "files.list")) {
    t.list_files = tool({
      description: "Pokazuje pliki na biurku użytkownika (Moje pliki oraz teczka bieżącej sprawy).",
      inputSchema: z.object({ folder: z.string().optional().describe('domyślnie "Moje pliki"') }),
      execute: async ({ folder }) => {
        const k = folder?.trim() || "Moje pliki"
        return step("list_files", `Przeglądam „${k}”`, { folder: k }, async () => {
          const l = await storage.list(u.id, k)
          const caseEntries = await storage.list(u.id, caseFolder).catch(() => [])
          return {
            summary: `${l.length + caseEntries.length} pozycji`,
            answer:
              [
                ...l.map((x) => `${x.folder ? "[katalog] " : ""}${x.path} (${x.size} B)`),
                ...caseEntries.map((x) => `${x.path} (${x.size} B)`),
              ].join("\n") || "(pusto)",
          }
        })
      },
    })
  }

  if (hasCapability(p, "files.read")) {
    t.read_file = tool({
      description: "Czyta zawartość pliku tekstowego z biurka użytkownika.",
      inputSchema: z.object({ path: z.string().describe('np. "Moje pliki/faktury-08.csv"') }),
      execute: async ({ path }) =>
        step("read_file", `Czytam ${path}`, { path }, async () => {
          // Bez tego readFile(utf8) na .jpg zwraca śmieci z ok:true i wpisuje je do dowodu
          // jako „odczytany plik" — czyli dowód poświadcza coś, czego nie było.
          const notText = notReadable(path)
          if (notText) {
            return { ok: false, summary: "to nie jest plik tekstowy", answer: notText }
          }
          try {
            const text = await storage.read(u.id, path)
            return {
              summary: `${text.split("\n").length} wierszy, ${text.length} znaków`,
              answer: text.slice(0, 60000),
            }
          } catch {
            return {
              ok: false,
              summary: "nie udało się otworzyć",
              answer: `Nie udało się otworzyć pliku ${path}.`,
            }
          }
        }),
    })
  }

  if (hasCapability(p, "document.write")) {
    t.write_document = tool({
      description:
        "Zapisuje gotowy dokument do teczki bieżącej sprawy. Format markdown albo zwykły tekst.",
      inputSchema: z.object({
        name: z.string().describe('np. "zestawienie-kosztow.md"'),
        text: z.string(),
      }),
      execute: async ({ name, text }) =>
        step("write_document", `Zapisuję ${name}`, { name }, async () => {
          await storage.write(u.id, `${caseFolder}/${name}`, text)
          return {
            summary: `${text.length} znaków`,
            answer: `Zapisano ${name} w teczce sprawy.`,
          }
        }),
    })
  }

  if (hasCapability(p, "document.verify")) {
    t.verify_document = tool({
      description:
        "Odczytuje zapisany dokument z teczki sprawy, żeby potwierdzić, co w nim faktycznie jest.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) =>
        step("verify_document", `Sprawdzam ${name} po zapisie`, { name }, async () => {
          try {
            const text = await storage.read(u.id, `${caseFolder}/${name}`)
            const empty = (text.match(/\[(WPISZ|UZUPEŁNIJ|TODO)[^\]]*\]/gi) ?? []).length
            return {
              summary: `${text.split("\n").length} wierszy, pustych pól: ${empty}`,
              answer: `Plik ma ${text.length} znaków. Nieuzupełnionych pól: ${empty}.\n\n${text.slice(0, 4000)}`,
            }
          } catch {
            return {
              ok: false,
              summary: "pliku nie ma",
              answer: `Pliku ${name} nie ma w teczce sprawy.`,
            }
          }
        }),
    })
  }

  if (hasCapability(p, "memory.write")) {
    t.remember = tool({
      description:
        "PROPONUJE zapamiętanie czegoś na przyszłość — nie zapamiętuje. Propozycja trafia " +
        "na ekran „Pamięć” i zaczyna działać dopiero, gdy człowiek ją przyjmie. Nigdy nie " +
        "mów, że coś zapamiętałeś; powiedz, że proponujesz to zapamiętać. " +
        "Proponuj rzeczy, które przydadzą się w KOLEJNYCH sprawach: jak wyglądają pliki tej " +
        "osoby, jak nazywa rzeczy, co zwykle chce dostać na końcu. Nigdy danych z jednej " +
        "sprawy, które za tydzień będą nieaktualne.",
      inputSchema: z.object({
        what: z.string().describe("jedno zdanie, do 400 znaków, w języku człowieka"),
      }),
      execute: async ({ what }) =>
        step("remember", `Proponuję zapamiętać: ${what.slice(0, 60)}`, { what }, async () => {
          await memory.propose(u.id, what, caseId)
          return {
            summary: what.slice(0, 120),
            answer:
              "Propozycja czeka na ekranie „Pamięć”. Powiedz człowiekowi, że może ją tam przyjąć albo odrzucić.",
          }
        }),
    })
  }

  if (hasCapability(p, "files.keep")) {
    t.save_to_my_files = tool({
      description:
        'Odkłada plik z teczki bieżącej sprawy do trwałych „Moich plików" użytkownika. ' +
        "Wywołuj WYŁĄCZNIE wtedy, gdy człowiek wyraźnie o to poprosił — to jego prywatna przestrzeń, " +
        "a nie miejsce, w którym sam z siebie zostawiasz robocze wyniki.",
      inputSchema: z.object({
        name: z.string().describe('nazwa pliku z teczki sprawy, np. "zestawienie-kosztow.md"'),
        folder: z.string().optional().describe('podfolder w „Moich plikach", domyślnie korzeń'),
      }),
      execute: async ({ name, folder }) => {
        const target = folder?.trim() ? `Moje pliki/${folder.trim()}/${name}` : `Moje pliki/${name}`
        return step(
          "save_to_my_files",
          `Odkładam ${name} do Moich plików`,
          { name, target },
          async () => {
            try {
              const stored = await storage.copy(u.id, `${caseFolder}/${name}`, target)
              return {
                summary: stored,
                answer: `Plik jest teraz w „Moich plikach" jako ${stored}.`,
              }
            } catch (e) {
              return {
                ok: false,
                summary: "nie udało się odłożyć",
                answer: `Nie udało się odłożyć pliku ${name} do Moich plików. ${String(e).slice(0, 120)}`,
              }
            }
          },
        )
      },
    })
  }

  if (hasCapability(p, "sheet.write")) {
    t.write_sheet = tool({
      description: "Zapisuje zestawienie jako arkusz CSV do teczki sprawy.",
      inputSchema: z.object({ name: z.string(), csv: z.string() }),
      execute: async ({ name, csv }) =>
        step("write_sheet", `Zapisuję arkusz ${name}`, { name }, async () => {
          // Komórka zaczynająca się od `=` jest przez Excela WYKONYWANA przy otwarciu.
          // Taki ciąg potrafi przyjść z pliku źródłowego klienta i zostać przepisany
          // przez model w dobrej wierze — a wtedy plik z naszą plakietką „sprawdzony
          // po zapisie" atakuje komputer tej osoby. Patrz `csv-safety.ts`.
          const safe = safeCsv(csv)
          await storage.write(u.id, `${caseFolder}/${name}`, safe.csv)
          const rows = safe.csv.split("\n").length
          return {
            // Neutralizacja jest widoczna w dowodzie, a nie cicha: człowiek ma wiedzieć,
            // że plik został ruszony, zanim zdziwi się apostrofem w komórce.
            summary:
              safe.neutralised > 0
                ? `${rows} wierszy, unieszkodliwionych formuł: ${safe.neutralised}`
                : `${rows} wierszy`,
            answer:
              safe.neutralised > 0
                ? `Zapisano arkusz ${name}. ${safe.neutralised} komórek zaczynało się znakiem, ` +
                  "który Excel wykonuje jako formułę — zapisałem je jako tekst. Powiedz o tym człowiekowi."
                : `Zapisano arkusz ${name}.`,
          }
        }),
    })
  }

  if (hasCapability(p, "code.run")) {
    t.run_computation = tool({
      description:
        'Uruchamia obliczenia na danych. Podaj kod w JavaScript (Node) oraz listę plików z biurka w polu `pliki` — zostaną zamontowane w katalogu roboczym pod swoimi nazwami (np. "faktury-08.csv"). Wypisz wynik przez console.log.',
      inputSchema: z.object({
        description: z.string().describe("po ludzku, co liczysz"),
        code: z.string(),
        files: z.array(z.string()).optional(),
      }),
      execute: async ({ description, code, files }) =>
        // `files` MUSI wejść do zdarzenia, nie tylko do wywołania piaskownicy: dowód
        // powstaje wyłącznie ze zdarzeń, więc czego tu nie ma, tego dla sprawy nie było.
        step("run_computation", description, { description, files: files ?? [] }, async () => {
          const box = await sandbox.create({
            user: u.id,
            caseId,
            mounts: (files ?? []).map((f) => ({
              fromDesk: f,
              as: f.split("/").pop()!,
              write: false,
            })),
            egress: [], // brak wyjścia do sieci — NIEEGZEKWOWANE w POC
          })
          // `finally` przy sprzątaniu piaskownicy, bo wyjątek w `exec` zostawiał
          // katalog i proces bez właściciela — a piaskownica ma po sobie sprzątać
          // także wtedy, gdy to ona jest przyczyną awarii.
          try {
            const r = await box.exec(code)
            return {
              ok: r.ok,
              summary: r.ok ? "policzone" : "błąd wykonania",
              answer: r.output || "(brak wyjścia)",
            }
          } finally {
            await box.dispose().catch(() => {})
          }
        }),
    })
  }

  if (hasCapability(p, "image.generate")) {
    t.generate_image = tool({
      description: "Generuje obraz na podstawie opisu i zapisuje go w teczce sprawy.",
      inputSchema: z.object({
        name: z.string().describe('np. "grafika.png"'),
        description: z.string(),
      }),
      execute: async ({ name, description }) =>
        step(
          "generate_image",
          `Generuję obraz: ${description.slice(0, 60)}`,
          { name, description },
          async () => {
            try {
              const res = await fetch(`${process.env.CORTEX_PROXY_URL}/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-User-ID": u.id },
                body: JSON.stringify({
                  model: process.env.DESK_IMAGE_MODEL,
                  modalities: ["image", "text"],
                  messages: [{ role: "user", content: description }],
                }),
              })
              // Kształt odpowiedzi dostawcy obrazów — tylko te pola, po które sięgamy niżej.
              type ImageResponse = {
                error?: { message?: string }
                choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[]
              }
              const j = (await res.json()) as ImageResponse
              const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url
              if (j?.error?.message) throw new Error(String(j.error.message))
              if (!url?.startsWith("data:")) throw new Error("dostawca nie zwrócił obrazu")
              // Bez przecinka nie ma ładunku, a `Buffer.from('', 'base64')` zapisałby pusty plik
              // pod nazwą obrazu — czyli artefakt, który wygląda na powstały i nie da się otworzyć.
              const b64 = url.split(",")[1]
              if (!b64) throw new Error("dostawca zwrócił obraz bez treści")
              await storage.write(u.id, `${caseFolder}/${name}`, Buffer.from(b64, "base64"))
              return { summary: `zapisano ${name}`, answer: `Obraz zapisany jako ${name}.` }
            } catch (e) {
              const m = String(e)
              const readably = /modalit|not a valid model|404/i.test(m)
                ? "Na tej instancji nie ma podłączonego modelu graficznego — administrator musi go udostępnić w cortex-proxy."
                : m.slice(0, 200)
              return {
                ok: false,
                summary: m.slice(0, 120),
                answer: `Nie udało się wygenerować obrazu. ${readably}`,
              }
            }
          },
        ),
    })
  }

  return t
}

/** Uruchamia turę w tle. Zwraca natychmiast — praca trwa bez podpiętego klienta. */
export async function runTurn(u: User, p: Policy, caseId: string) {
  // Ani treść zlecenia, ani załączniki NIE są tu parametrami, choć kiedyś były: trasa
  // dopisuje zdarzenie `mysl` razem z nimi PRZED wywołaniem tury, więc historia niżej
  // i tak je odczytuje. Drugie źródło tej samej informacji rozjeżdżało się przy każdej
  // poprawce jednego z nich — i już raz wysłało modelowi to samo polecenie dwa razy,
  // naliczając podwójny koszt.
  await migrate()
  await pool.query(
    `update desk.case_file set status='working', reason=null, updated_at=now() where id=$1`,
    [caseId],
  )
  await appendEvent(caseId, { type: "lifecycle", status: "start" })
  // Pamięć wpływa na turę, ale nie zostawia zdarzenia narzędzia — więc panel dowodu
  // by jej nie zobaczył. Zapisujemy identyfikatory wstrzykniętych wspomnień, żeby
  // zdanie „asystent pamiętał wtedy te trzy rzeczy" było ODCZYTEM z historii,
  // a nie deklaracją. Ta sama zasada, co przy pochodzeniu pliku.
  const remembered = await memory.kept(u.id)
  await audit.write(u.id, "turn.start", {
    caseId,
    fingerprint: p.fingerprint,
    capabilities: p.granted.map((z) => z.id),
    remembered: remembered.map((m) => m.id),
  })

  // Szew MCP jest prawdziwy od tego commita, choć katalog serwerów jest pusty.
  // Narzędzia z zatwierdzonych serwerów przechodzą przez TĘ SAMĄ bramę zdolności
  // i ten sam filtr na odkryciu, co wbudowane — inaczej byłaby to druga furtka.
  const mcp = await mcpTools(p, (e) => appendEvent(caseId, e))
  const tools = { ...toolsForPolicy(u, p, caseId), ...mcp.tools }

  const history = await pool.query<{ payload: DeskEvent }>(
    `select payload from desk.event where case_id=$1 order by seq`,
    [caseId],
  )
  // Obrazy z załączników idą do modelu jako obraz, nie jako nazwa pliku — inaczej agent
  // odpowiada „nie umiem czytać obrazków", choć model widzi. Limitujemy liczbę, bo każdy
  // obraz kosztuje przy każdej kolejnej turze tej samej sprawy.
  const MAX_IMAGES = 4

  async function messageParts(text: string, files: string[]) {
    const images = files.filter((n) => /\.(png|jpe?g|gif|webp)$/i.test(n))
    const others = files.filter((n) => !images.includes(n))
    const parts: Extract<ModelMessage, { role: "user" }>["content"] = []
    for (const name of images) {
      try {
        const data = await storage.readBinary(u.id, `${storage.caseFolder(u.id, caseId)}/${name}`)
        parts.push({ type: "image", image: data, mediaType: imageMediaType(name) })
      } catch {
        others.push(name)
      }
    }
    const otherDescription = others.length
      ? `\n\n[Załączone pliki w teczce sprawy: ${others.join(", ")}]`
      : ""
    parts.push({ type: "text", text: text + otherDescription })
    return parts
  }

  const messages: ModelMessage[] = []
  let imageBudget = MAX_IMAGES
  const promptHistory = history.rows.filter((r) => r.payload.type === "prompt")
  const imagesAllowedFrom = Math.max(0, promptHistory.length - 1)

  let promptCounter = 0
  for (const r of history.rows) {
    const e = r.payload
    if (e.type === "assistant") messages.push({ role: "assistant", content: e.text })
    if (e.type === "prompt") {
      const previous = e.attachments ?? []
      // obrazy ze starszych tur pomijamy — liczy się bieżące pytanie i to bezpośrednio przed nim
      const allowed = promptCounter >= imagesAllowedFrom && imageBudget > 0
      promptCounter++
      if (allowed && previous.length) {
        const parts = await messageParts(e.text, previous)
        imageBudget -= parts.filter((c) => c.type === "image").length
        messages.push({ role: "user", content: parts })
      } else {
        const description = previous.length
          ? `\n\n[Załączone pliki w teczce sprawy: ${previous.join(", ")}]`
          : ""
        messages.push({ role: "user", content: e.text + description })
      }
    }
  }
  // Uwaga: trasa dopisuje zdarzenie „mysl" PRZED wywołaniem tury, więc bieżące polecenie
  // jest już ostatnią pozycją historii powyżej. Doklejanie go tu po raz drugi wysyłało
  // model dwa razy to samo — i podwójnie naliczało koszt oraz obraz.

  // Zdania idą do modelu DOSŁOWNIE — budowa bloku siedzi w `memory.ts`, bo tam da się
  // ją sprawdzić bez wołania modelu.
  const recalled = memory.recallBlock(remembered)

  void (async () => {
    const signal = beginTurn(caseId)
    // Koszt zliczany PO KAŻDYM KROKU, a nie dopiero z wyniku tury.
    //
    // Bez tego tura przerwana albo przewrócona była pracą za darmo: `generateText`
    // rzuca wyjątkiem, `result.steps` nie istnieje, więc kilkanaście przepracowanych
    // żądań do modelu nie zostawiało ani grosza w dzienniku ani w dziennym limicie.
    // Człowiek mógł wyczerpać budżet firmy turami, które zawsze przerywa.
    let spentInSteps = 0
    try {
      const result = await generateText({
        model: model(u.id),
        system: `${SYSTEM}\n\nUżytkownik: ${u.firstName} ${u.lastName}, dział ${u.department}. Teczka bieżącej sprawy: ${storage.caseFolder(u.id, caseId)}.${recalled}`,
        messages: messages,
        tools: tools,
        stopWhen: stepCountIs(12),
        maxOutputTokens: OUTPUT_CEILING,
        abortSignal: signal,
        onStepFinish: (s) => {
          spentInSteps += stepCost(s as unknown as WithProviderMetadata) ?? 0
        },
      })

      // Rzutowanie na wspólny kształt: `GenerateTextResult` ma własne, węższe typy metadanych
      // dostawcy, a `turnCost` interesuje wyłącznie jedno pole, którego tamte nie deklarują,
      // bo wstawia je nasz `metadataExtractor`.
      const cost = turnCost(result as unknown as TurnResult)
      if (result.text?.trim())
        await appendEvent(caseId, { type: "assistant", text: result.text.trim() })
      if (cost.usd > 0)
        await appendEvent(caseId, { type: "cost", usd: cost.usd, basis: cost.basis })
      // Wyczerpanie limitu kroków było DO TEJ PORY nieodróżnialne od sukcesu: model
      // przestawał pracować w połowie zadania, `finishReason` nie czytał nikt, a sprawa
      // pokazywała się jako gotowa. Człowiek dostawał ciszę i nie wiedział, że ma powtórzyć.
      const exhausted = result.finishReason === "tool-calls"
      // Bez `reason`: zdanie dla człowieka stoi w słowniku ekranu pod `case.exhausted`.
      // Wpisane tutaj zamroziłoby polszczyznę w historii sprawy — tak samo jak przy nazwach
      // zdolności, i z tego samego powodu.
      await appendEvent(caseId, { type: "lifecycle", status: exhausted ? "exhausted" : "end" })
      // `and status='working'` — bez tego domknięcie tury nadpisywało „przerwane"
      // na „gotowe" i przycisk „przerwij" kłamał.
      await pool.query(
        `update desk.case_file set status='done', reason=null, cost_usd=cost_usd+$2, updated_at=now() where id=$1 and status='working'`,
        [caseId, cost.usd],
      )
      await audit.write(u.id, "turn.end", {
        caseId,
        costUsd: cost.usd,
        costBasis: cost.basis,
      })
    } catch (e) {
      // Koszt tego, co JUŻ zostało zrobione, zapisujemy zawsze — także gdy tura się
      // przewróciła albo została przerwana. Inaczej dzienny limit pilnowałby wyłącznie
      // tur zakończonych powodzeniem.
      if (spentInSteps > 0) {
        await appendEvent(caseId, { type: "cost", usd: spentInSteps, basis: "provider" })
        await pool.query(
          `update desk.case_file set cost_usd=cost_usd+$2, updated_at=now() where id=$1`,
          [caseId, spentInSteps],
        )
        await audit.write(u.id, "turn.end", {
          caseId,
          costUsd: spentInSteps,
          costBasis: "provider",
          partial: true,
        })
      }
      // Przerwanie na życzenie człowieka NIE jest awarią. Stan zapisał już `case-stop`,
      // tutaj zostaje wyłącznie nie pisać o awarii tam, gdzie jej nie było.
      if (wasAborted(e)) {
        await audit.write(u.id, "turn.stopped", { caseId, source: "abort" })
        return
      }
      const reason = readableFailure(e)
      await appendEvent(caseId, {
        type: "lifecycle",
        status: "failed",
        reason,
        ...(isInfrastructure(e) ? { kind: "infrastructure" as const } : {}),
      })
      await pool.query(
        `update desk.case_file set status='failed', reason=$2, updated_at=now() where id=$1 and status='working'`,
        [caseId, reason],
      )
      // Zdanie po polsku trafia na ekran pracownika, surowa treść wyłącznie do dziennika.
      // Bez niej diagnoza sprowadza się do zgadywania, KTÓRA gałąź `readableFailure` zadziałała,
      // a to już raz kosztowało pół dnia szukania nieistniejącego braku środków.
      await audit.write(u.id, "turn.failed", {
        caseId,
        reason,
        raw: String((e as { message?: unknown })?.message ?? e).slice(0, 400),
      })
    } finally {
      endTurn(caseId)
      // Połączenia do serwerów MCP żyją dokładnie tyle, co tura — ani krócej
      // (model sięga po narzędzie w środku `generateText`), ani dłużej.
      await mcp.close()
    }
  })()
}

/** Zwraca wyjaśnienie po polsku, jeśli pliku po prostu nie da się przeczytać jako tekst. */
function notReadable(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic"].includes(ext)) {
    return "To jest obraz, nie plik tekstowy. Poproś użytkownika, żeby dołączył go do wiadomości — wtedy go zobaczysz."
  }
  if (["xlsx", "xls"].includes(ext)) {
    return "Nie umiem otworzyć pliku Excela. Poproś użytkownika, żeby zapisał go jako CSV (w Excelu: Plik → Zapisz jako → CSV) i wgrał ponownie."
  }
  if (ext === "docx" || ext === "doc") {
    return "Nie umiem otworzyć pliku Worda. Poproś użytkownika o wersję w formacie tekstowym albo o wklejenie treści."
  }
  if (ext === "pdf") {
    return "Nie umiem odczytać PDF-a. Poproś użytkownika o wersję tekstową albo o wklejenie potrzebnego fragmentu."
  }
  if (["zip", "rar", "7z", "exe", "dmg"].includes(ext)) {
    return "To jest archiwum albo program, nie dokument. Nie umiem tego otworzyć."
  }
  return null
}

const CAPABILITY_HINTS: Record<string, RegExp> = {
  "sheet.write": /arkusz|excel|xlsx|spreadsheet|csv|tabel/i,
  "code.run": /policz|oblicz|przelicz|wykres|skrypt|kod|statystyk/i,
  "image.generate": /obraz|grafik|rysun|ilustrac|zdjęci|wygeneruj.*obraz/i,
  "files.keep": /moich plik|do moich|trwal/i,
  "document.write": /zapisa.*dokument|utworzy.*plik/i,
  "files.read": /przeczyta|odczyta|otworzy.*plik/i,
  "files.list": /list plik|zajrze.*teczk|zobaczy.*plik/i,
  "counterparty.verify":
    /biał[ae] li[sś]|wykaz podatnik|status vat|czynn.*podatnik|\bnip\b|rachunek.*kontrahent|nale[żz]yt.*starann/i,
}

/** Model opisuje brak swoimi słowami — nazwę zdolności i dział dokładamy my. */
function matchCapability(description: string, blocked: Policy["blocked"]) {
  return blocked.find((z) => CAPABILITY_HINTS[z.id]?.test(description))
}

function imageMediaType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()
  return ext === "png"
    ? "image/png"
    : ext === "gif"
      ? "image/gif"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg"
}

/**
 * Stawki zapasowe, w dolarach za milion tokenów. Domyślne to cennik modelu
 * z `DESK_MODEL` (Sonnet 5: 2 / 10) — i to jest sprzężenie, o którym trzeba
 * wiedzieć: zmiana modelu bez zmiany tych liczb zostawia dzienny limit
 * pracownika liczony wedle cennika modelu, którego już nie ma.
 *
 * Liczą się WYŁĄCZNIE wtedy, gdy dostawca nie odda kosztu — a cortex-proxy oddaje
 * go w `usage.cost`. Dlatego są zapasem, nie cennikiem: przy stawkach ustawionych
 * źle biurko nie policzy pracy dwa razy drożej, tylko dopiero wtedy, gdy przestanie
 * dostawać prawdziwą liczbę.
 */
const INPUT_RATE = Number(process.env.DESK_INPUT_RATE ?? 2)
const OUTPUT_RATE = Number(process.env.DESK_OUTPUT_RATE ?? 10)

type WithProviderMetadata = {
  providerMetadata?: Record<string, Record<string, unknown>> | undefined
  experimental_providerMetadata?: Record<string, Record<string, unknown>> | undefined
}

const stepCost = (x: WithProviderMetadata | undefined): number | undefined => {
  const meta = x?.providerMetadata ?? x?.experimental_providerMetadata
  const c = meta?.["cortex-proxy"]?.cost ?? meta?.openaiCompatible?.cost
  return typeof c === "number" ? c : undefined
}

type TurnCost = { usd: number; basis: "provider" | "estimate" }

type TurnResult = WithProviderMetadata & {
  steps?: unknown[] | undefined
  usage?:
    | {
        inputTokens?: number
        promptTokens?: number
        outputTokens?: number
        completionTokens?: number
      }
    | undefined
}

function turnCost(result: TurnResult): TurnCost {
  // SUMA PO KROKACH, nie koszt ostatniego. Tura sięga po narzędzia, więc `generateText`
  // robi do dwunastu żądań, a `providerMetadata` na wyniku pochodzi z ostatniego z nich.
  // Branie jej wprost liczyło jedno żądanie z kilkunastu — i to akurat najtańsze,
  // bo domykające.
  const steps = Array.isArray(result?.steps) ? (result.steps as WithProviderMetadata[]) : []
  const fromSteps = steps.map(stepCost).filter((c): c is number => c !== undefined)
  if (fromSteps.length) return { usd: fromSteps.reduce((a, b) => a + b, 0), basis: "provider" }

  const fromResult = stepCost(result)
  if (fromResult !== undefined) return { usd: fromResult, basis: "provider" }

  const u = result?.usage ?? {}
  const we = u.inputTokens ?? u.promptTokens ?? 0
  const wy = u.outputTokens ?? u.completionTokens ?? 0
  return { usd: (we / 1e6) * INPUT_RATE + (wy / 1e6) * OUTPUT_RATE, basis: "estimate" }
}
