import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { z } from "zod"
import * as audit from "./audit-log"
import { hasCapability } from "./capability-gate"
import { safeCsv } from "./csv-safety"
import { migrate, pool } from "./db"
import * as storage from "./desk-storage"
import {
  DocumentParserFailure,
  isRecognisable,
  notReadable,
  recogniseDocument,
  recognitionAnswer,
  recognitionSummary,
} from "./document-parser"
import { isInfrastructure, readableFailure, sandboxFailureLine } from "./failure"
import { isShared } from "./folder"
import { mcpTools } from "./mcp/client"
import * as memory from "./memory"
import * as people from "./people"
import { hintFor } from "./procedures/hint"
import { promptBlock } from "./procedures/prompt-block"
import { activeProcedures, type StoredProcedure } from "./procedures/store"
import { visibleFor } from "./procedures/visible"
import * as sandbox from "./sandbox"
import { refuseShared } from "./shared-access"
import { beginTurn, endTurn, wasAborted } from "./turn-control"
import type { DeskEvent, FileMeta, Policy, StepFailure, User } from "./types"

/**
 * Ile znaków pliku trafia do modelu. Sufit musi istnieć — okno kontekstu jest skończone —
 * ale ma o sobie MÓWIĆ. Wartość dobrana pod dokumenty księgowe: 60 tys. znaków to ok. 30
 * stron zwykłego tekstu i mieści typowe zestawienie miesięczne w całości.
 */
const READ_LIMIT = 60_000

/**
 * Ile TRAFIEŃ szukanie oddaje modelowi. Sufit stoi na wyniku, nie na liczbie przeszukanych
 * plików, i to jest zmierzone: 5000 dokumentów przechodzi w 339 ms, ale niesie 743 trafienia.
 * Turę zabijają trafienia, a nie pliki — ograniczenie wejścia kosztowałoby więc odpowiedzi
 * („tych plików nie sprawdziłem”) tam, gdzie kosztu w ogóle nie ma.
 *
 * Sto wierszy z fragmentami mieści się w ułamku sufitu `read_file` i wystarcza, żeby model
 * wskazał właściwy plik. Obcięcie MÓWI O SOBIE — inaczej byłby to trzeci raz, gdy ten produkt
 * podaje wynik ucięty nieodróżnialny od kompletnego.
 */
const MATCH_LIMIT = 100

/**
 * Największy plik, do którego szukanie zajrzy. Nie jest to ostrożność wobec dysku: cała
 * zawartość ląduje w pamięci procesu Biurka, a ten obsługuje wszystkie tury naraz, więc
 * jeden eksport bazy potrafi zatrzymać pracę wszystkim. Trzydzieści razy sufit `read_file`
 * to granica, za którą plik przestaje być dokumentem księgowym.
 *
 * Plik odrzucony na tym suficie jest NAZWANY w odpowiedzi — po to, żeby dało się go wskazać
 * wprost i przeczytać czynnością `read_file`, zamiast dowiadywać się o nim po ciszy.
 */
const SEARCH_FILE_LIMIT = 2_000_000

/** Ile znaków fragmentu wokół trafienia widzi model — tyle, ile trzeba, by poznać kontekst. */
const FRAGMENT = 160

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
type StepResult = {
  ok?: boolean
  summary: string
  answer: string
  /**
   * POWÓD niepowodzenia — wartość ze skończonej listy, nie zdanie. `summary` jest
   * polskim zdaniem dla dowodu i nie da się z niego wyprowadzić rady „co teraz"
   * inaczej niż dopasowaniem napisu; powód da się. Krok udany go nie ma.
   */
  reason?: StepFailure
  /**
   * Argumenty, które czynność poznała DOPIERO wykonując pracę — dziś: pliki, w których
   * szukanie znalazło trafienie. Jadą do `tool_end`, bo dowód powstaje wyłącznie ze
   * zdarzeń: czego tu nie ma, tego dla sprawy nie było. Patrz `DeskEvent.tool_end`.
   */
  discovered?: Record<string, unknown>
}

/**
 * Wszystkie PLIKI w katalogu i jego podkatalogach, ścieżkami logicznymi.
 *
 * Idzie przez `desk-storage`, a nie przez `node:fs` — bo to tamten moduł, i tylko on, stoi
 * między nazwą podaną przez model a dyskiem, i tylko on wie, że wspólna półka ma inny korzeń.
 * Własne czytanie katalogu byłoby drugą drogą do tych samych plików, czyli drugim miejscem,
 * w którym trzeba pamiętać o wyjściu poza biurko.
 *
 * Błędu NIE ŁYKAMY: katalog, do którego nie dało się zajrzeć, ma wywrócić całe szukanie.
 * Po cichu pominięty podkatalog dałby odpowiedź „nic nie znalazłem” o korpusie, którego
 * połowy nikt nie oglądał — czyli cichą złą odpowiedź, najgorszy możliwy wynik.
 */
async function filesUnder(user: string, folder: string, depth = 6): Promise<FileMeta[]> {
  const found: FileMeta[] = []
  const descend = async (where: string, level: number): Promise<void> => {
    for (const entry of await storage.list(user, where)) {
      if (!entry.folder) {
        found.push(entry)
        continue
      }
      // Sufit zagnieżdżenia broni przed dowiązaniem w kółko; katalog głębszy niż sześć
      // pięter to nie jest układ, w którym pani Basia trzyma faktury.
      if (level < depth) await descend(entry.path, level + 1)
    }
  }
  await descend(folder, 0)
  return found
}

/**
 * Fragment wiersza WOKÓŁ trafienia, nie jego początek. Wiersz arkusza bywa długi, a szukane
 * słowo stoi w nim gdziekolwiek — pierwsze 160 znaków pokazałoby wtedy sam nagłówek kolumn
 * i ani razu tego, po co model tu przyszedł. Ucięcie z obu stron znaczymy wielokropkiem.
 */
function fragmentAround(line: string, at: number): string {
  const from = Math.max(0, at - Math.floor(FRAGMENT / 3))
  const piece = line.slice(from, from + FRAGMENT)
  const tidy = piece.replace(/\s+/g, " ").trim()
  return `${from > 0 ? "…" : ""}${tidy}${from + FRAGMENT < line.length ? "…" : ""}`
}

export function toolsForPolicy(
  u: User,
  p: Policy,
  caseId: string,
  /**
   * Procedury, które obowiązują TĘ osobę — już przefiltrowane przez zasięg. Wchodzą
   * parametrem, a nie odczytem z bazy w środku, bo `toolsForPolicy` jest synchroniczne
   * i takie ma zostać: to jest rejestr czynności, a nie miejsce na zapytania.
   */
  procedures: StoredProcedure[] = [],
) {
  const caseFolder = storage.caseFolder(u.id, caseId)
  const emit = (e: DeskEvent) => appendEvent(caseId, e)
  /**
   * Procedury otwarte W TEJ TURZE. Żyje w domknięciu, bo `toolsForPolicy` woła się raz
   * na turę — ten sam zasięg, co zestaw narzędzi. Służy do jednego: żeby wskazówka trybu
   * `paths` nie powtarzała się przy każdym kolejnym pliku z tego samego katalogu.
   */
  const opened = new Set<string>()

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
    // `reason` jest opcjonalny CELOWO: krok udany powodu nie ma, a `exactOptionalPropertyTypes`
    // odróżnia „klucza nie ma" od „klucz jest i ma undefined". Stąd rozgałęzienie przy
    // składaniu obiektu zamiast wpisania `reason: r.reason`.
    let end: {
      ok: boolean
      summary: string
      reason?: StepFailure
      discovered?: Record<string, unknown>
    } = {
      ok: false,
      summary: "przerwane",
      reason: "interrupted",
    }
    let answer = "Czynność nie doszła do skutku."
    try {
      const r = await body()
      end = {
        ok: r.ok !== false,
        summary: r.summary,
        ...(r.reason === undefined ? {} : { reason: r.reason }),
        ...(r.discovered === undefined ? {} : { discovered: r.discovered }),
      }
      answer = r.answer
      /**
       * TRYB `paths` — wskazówka doklejana do ODPOWIEDZI DLA MODELU, nigdy do `summary`.
       *
       * Miejsce jest tutaj, a nie w poszczególnych czynnościach, z tego samego powodu, dla
       * którego `tool_end` leci z `finally`: czynność dopisana za rok nie ma gdzie o tym
       * zapomnieć. Wzorzec przejęty z OpenHands — reguła przypięta do katalogu nie kosztuje
       * ani znaku w prompcie, dopóki ktoś do tego katalogu nie sięgnie.
       *
       * `summary` zostaje NIETKNIĘTY, bo `summary` jest dowodem. Podpowiedź nie jest
       * zdarzeniem i nie ma prawa wyglądać w dowodzie jak czynność, która się wydarzyła.
       */
      if (end.ok) {
        const hint = hintFor(procedures, args, opened)
        if (hint) answer = `${answer}\n\n${hint}`
      }
    } catch (e) {
      // Dowód mówi, że się NIE udało, a model dostaje zdanie, z którym da się coś zrobić.
      // Surowa treść wyjątku nie idzie ani na ekran, ani do modelu w całości — bywa w niej
      // ścieżka z serwera albo klucz z nagłówka.
      end = { ok: false, summary: "czynność się nie powiodła", reason: "unknown" }
      answer = `Nie udało się wykonać tej czynności. ${String(e).slice(0, 160)}`
    } finally {
      // NIEZMIENNIK: krok nieudany ZAWSZE niesie powód. Bez tego narzędzie dopisane za rok
      // wróciłoby po cichu do stanu, w którym ekran nie ma z czego powiedzieć „co teraz" —
      // dokładnie tak, jak wcześniej nie miał z czego powiedzieć, że coś się nie udało.
      const closing =
        !end.ok && end.reason === undefined ? { ...end, reason: "unknown" as const } : end
      await emit({ type: "tool_end", id, name, ...closing, ms: Date.now() - start })
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

  // Brama wspólnej półki pyta o zdolność tej osoby — ta sama funkcja, co przy wszystkich
  // pozostałych. Drugiego modelu uprawnień nie ma i mieć nie będzie (ADR-0001).
  const may = (id: string) => hasCapability(p, id)

  if (hasCapability(p, "files.list")) {
    t.list_files = tool({
      description: "Pokazuje pliki na biurku użytkownika (Moje pliki oraz teczka bieżącej sprawy).",
      inputSchema: z.object({ folder: z.string().optional().describe('domyślnie "Moje pliki"') }),
      execute: async ({ folder }) => {
        const k = folder?.trim() || "Moje pliki"
        return step("list_files", `Przeglądam „${k}”`, { folder: k }, async () => {
          const nie = refuseShared(may, k, "read")
          if (nie)
            return {
              ok: false,
              summary: "brak dostępu do wspólnej półki",
              reason: "no-access",
              answer: nie,
            }
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
          const notText = notReadable(path, hasCapability(p, "document.read"))
          if (notText) {
            return {
              ok: false,
              summary: "to nie jest plik tekstowy",
              reason: "wrong-kind",
              answer: notText,
            }
          }
          const nie = refuseShared(may, path, "read")
          if (nie)
            return {
              ok: false,
              summary: "brak dostępu do wspólnej półki",
              reason: "no-access",
              answer: nie,
            }
          try {
            const text = await storage.read(u.id, path)
            // Obcięcie MÓWI o sobie — w obu kierunkach. Wcześniej `slice(60000)` ucinało
            // po cichu, a podsumowanie podawało PEŁNĄ długość: dowód poświadczał odczyt
            // całego pliku, którego model nigdy w całości nie zobaczył.
            const cut = text.length > READ_LIMIT
            const shown = cut ? text.slice(0, READ_LIMIT) : text
            return {
              summary: cut
                ? `${text.length} znaków, pokazane pierwsze ${READ_LIMIT}`
                : `${text.split("\n").length} wierszy, ${text.length} znaków`,
              answer: cut
                ? `${shown}\n\n[Plik jest dłuższy — powyżej pierwsze ${READ_LIMIT} z ${text.length} znaków.]`
                : shown,
            }
          } catch {
            return {
              ok: false,
              summary: "nie udało się otworzyć",
              reason: "cannot-open",
              answer: `Nie udało się otworzyć pliku ${path}.`,
            }
          }
        }),
    })

    /**
     * SZUKANIE BIEGNIE W TYM PROCESIE — nie w piaskownicy i nie w indeksie w Postgresie.
     * Trzy warianty, zmierzone, nie oszacowane:
     *
     *   24 faktury      proces Biurka   8,8 ms │ piaskownica  192 ms │ indeks ~1,3 ms + wgranie
     *   5000 dokumentów proces Biurka    339 ms │ piaskownica 1762 ms │ indeks  1,2–2,1 ms
     *
     * Piaskownica jest 22× wolniejsza na realnym korpusie, ale odpada z powodu cięższego niż
     * czas: żeby cokolwiek przeszukać, trzeba najpierw skopiować do niej CAŁY korpus, czyli
     * zrobić DRUGĄ kopię dokumentów klienta. Indeks w bazie wygrywa czasem i przegrywa tym
     * samym — jest trzecią kopią treści, a do tego polskiej konfiguracji wyszukiwania
     * pełnotekstowego (`hunspell-pl`) w obrazie `postgres:16` po prostu NIE MA.
     *
     * Wariant tutejszy jest jedyny, który zostawia ślad NA KAŻDYM przeszukanym pliku:
     * brama wspólnej półki i osąd „czy to tekst” zapadają per plik, w tym samym kodzie,
     * co przy `read_file`. Kopia, którą trzeba by wpierw zrobić, żadnej z tych bram
     * by nie przeszła — bo przechodzi się je raz, przy kopiowaniu, a nie przy czytaniu.
     *
     * ZDOLNOŚĆ TA SAMA CO PRZY CZYTANIU (`files.read`), i to nie jest oszczędność. Szukanie
     * JEST czytaniem: otwiera pliki tej osoby i wnosi ich fragmenty do sprawy. Osobna
     * zdolność musiałaby przejść test rozłączności z ADR-0001 — a nie ma sytuacji, w której
     * ktoś ma czytać swoje pliki, ale nie ma prawa ich przeszukać. Byłaby za to nową kłódką
     * dla pani Basi w jej podstawowym zadaniu.
     */
    t.find_in_files = tool({
      description:
        "Szuka słowa albo zwrotu w plikach tekstowych na biurku użytkownika i oddaje pasujące " +
        "wiersze razem ze ścieżkami. Używaj tego ZAMIAST otwierania plików po kolei, gdy nie " +
        "wiesz, w którym z nich jest odpowiedź. Widzi wyłącznie tekst — PDF-y, skany, arkusze " +
        "Excela i pliki Worda zostaną pominięte i wymienione osobno; do nich służy read_document. " +
        "Odpowiedź mówi, ile plików przeszukano i ile pominięto: nie twierdź, że czegoś nie ma, " +
        "dopóki nie przeczytasz tych liczb.",
      inputSchema: z.object({
        query: z.string().describe("szukany zwrot, np. „Orange” albo numer faktury"),
        folder: z.string().optional().describe("gdzie szukać, domyślnie „Moje pliki”"),
      }),
      execute: async ({ query, folder }) => {
        const where = folder?.trim() || "Moje pliki"
        return step(
          "find_in_files",
          `Szukam „${query}” w „${where}”`,
          { query, folder: where },
          async () => {
            const needle = query.trim().toLocaleLowerCase("pl")
            // Pusty zwrot pasuje do każdego wiersza, więc szukanie nim nie jest szukaniem.
            // Powód bierzemy z zamkniętej listy — dwunasty, dla pomyłki modelu, którą model
            // sam poprawia w tej samej turze, kosztowałby dwa słowniki i strażnika.
            if (needle === "") {
              return {
                ok: false,
                summary: "pusty zwrot — nie ma czego szukać",
                reason: "wrong-kind",
                answer:
                  "Podaj, czego mam szukać. Pusty zwrot pasuje do każdego wiersza w każdym pliku.",
              }
            }

            let candidates: FileMeta[]
            try {
              candidates = await filesUnder(u.id, where)
            } catch {
              return {
                ok: false,
                summary: "nie udało się przejrzeć katalogu",
                reason: "cannot-open",
                answer:
                  `Nie udało się zajrzeć do katalogu ${where}. Sprawdź czynnością list_files, ` +
                  "jak on się naprawdę nazywa.",
              }
            }

            const mayRecognise = hasCapability(p, "document.read")
            // CZTERY POWODY POMINIĘCIA, LICZONE OSOBNO. Jeden licznik „pominięto” byłby
            // powtórzeniem błędu, który siedział już w `run_computation`: „za duże” i „nie
            // udało się” to dla człowieka dwa różne wyjścia, a zlane w jedną liczbę
            // przestają nimi być. Po ciszy zaś odpowiedź „nic nie znalazłem” na katalogu
            // pełnym PDF-ów jest nieprawdą wypisaną z powagą.
            const skippedShared: string[] = []
            const skippedNotText: string[] = []
            const skippedTooBig: string[] = []
            const skippedUnopened: string[] = []
            const matched: string[] = []
            const lines: string[] = []
            let searched = 0
            let hits = 0
            let filesWithHits = 0

            for (const file of candidates) {
              // Brama wspólnej półki PER PLIK, tą samą funkcją co w `read_file`. Katalog
              // może mieszać własne pliki z firmowymi, więc pytanie raz na całe szukanie
              // albo odmawiałoby za dużo, albo wpuszczało za dużo.
              if (refuseShared(may, file.path, "read")) {
                skippedShared.push(file.path)
                continue
              }
              // Ten sam osąd, co przy `read_file`: `readFile(utf8)` na PDF-ie oddaje śmieci,
              // które w wyniku szukania wyglądałyby jak treść dokumentu.
              if (notReadable(file.path, mayRecognise)) {
                skippedNotText.push(file.path)
                continue
              }
              if (file.size > SEARCH_FILE_LIMIT) {
                skippedTooBig.push(file.path)
                continue
              }
              let text: string
              try {
                text = await storage.read(u.id, file.path)
              } catch {
                skippedUnopened.push(file.path)
                continue
              }
              searched += 1

              let hitHere = false
              for (const [index, line] of text.split("\n").entries()) {
                const at = line.toLocaleLowerCase("pl").indexOf(needle)
                if (at < 0) continue
                // Liczymy DALEJ po zapełnieniu listy — sufit stoi na tym, co wraca do modelu,
                // a nie na tym, ile naprawdę jest. Inaczej zdanie o obcięciu nie miałoby
                // z czego powiedzieć, ile trafień zostało za nim.
                hits += 1
                if (!hitHere) {
                  hitHere = true
                  filesWithHits += 1
                }
                if (lines.length >= MATCH_LIMIT) continue
                if (!matched.includes(file.path)) matched.push(file.path)
                lines.push(`${file.path}:${index + 1}: ${fragmentAround(line, at)}`)
              }
            }

            /** Kilka nazw na przykład — pełna lista pominiętych bywa dłuższa niż wynik. */
            const few = (list: string[]) =>
              list.slice(0, 5).join(", ") + (list.length > 5 ? ", …" : "")

            const cut = hits > lines.length
            // Liczby w mianowniku z dwukropkiem, nie „12 trafień”: liczebnik sklejony
            // z rzeczownikiem w kodzie daje „1 trafień” przy pierwszym trafieniu.
            const skipped = [
              skippedNotText.length > 0 ? `nietekstowe: ${skippedNotText.length}` : "",
              skippedShared.length > 0 ? `bez wglądu we wspólne: ${skippedShared.length}` : "",
              skippedTooBig.length > 0 ? `za duże: ${skippedTooBig.length}` : "",
              skippedUnopened.length > 0 ? `nieotwarte: ${skippedUnopened.length}` : "",
            ].filter((one) => one !== "")

            const summary =
              `„${query}” — trafienia: ${hits}, pliki z trafieniami: ${filesWithHits}, ` +
              `przeszukane: ${searched}` +
              (cut ? `, pokazane pierwsze: ${lines.length}` : "") +
              (skipped.length > 0 ? `, pominięte — ${skipped.join(", ")}` : "")

            const said: string[] = []
            if (lines.length > 0) said.push(lines.join("\n"))
            said.push(
              hits === 0
                ? `Ani jednego trafienia na „${query}”. Przeszukane pliki: ${searched}.`
                : cut
                  ? `Trafienia: ${hits}, pliki z trafieniami: ${filesWithHits}, przeszukane pliki: ` +
                    `${searched}. POWYŻEJ JEST PIERWSZE ${lines.length} TRAFIEŃ — reszty tu nie ma. ` +
                    "Zawęź zwrot albo wskaż katalog, jeśli potrzebujesz całości."
                  : `Trafienia: ${hits}, pliki z trafieniami: ${filesWithHits}, ` +
                    `przeszukane pliki: ${searched}.`,
            )

            if (skippedNotText.length > 0) {
              said.push(
                `Pominięte, bo to nie są pliki tekstowe: ${skippedNotText.length} ` +
                  `(${few(skippedNotText)}). Nie wiem, co w nich jest — nie mów człowiekowi, ` +
                  "że czegoś tam nie ma.",
              )
              // Zdanie o drodze do tych plików pisze `notReadable`, bo to ono zna listę
              // formatów, które rozpoznawanie obsługuje, ORAZ obie sytuacje: ze zdolnością
              // (adres czynności `read_document`) i bez niej (droga do zgody przez report_gap).
              // Przykład wybieramy spośród tych, które w ogóle da się rozpoznać — inaczej
              // rada powstałaby na archiwum i nie odesłałaby nigdzie.
              const example = skippedNotText.find((one) => isRecognisable(one)) ?? skippedNotText[0]
              const why = example ? notReadable(example, mayRecognise) : null
              if (why) said.push(why)
            }
            if (skippedShared.length > 0) {
              // Same liczby, BEZ nazw: nazwa pliku ze wspólnej półki jest treścią, której
              // ta osoba nie ma prawa zobaczyć, a odmowa nie może być drogą do jej poznania.
              const refusal = refuseShared(may, skippedShared[0] ?? "", "read")
              said.push(
                `Pominięte, bo leżą na wspólnej półce: ${skippedShared.length}. ${refusal ?? ""}`,
              )
            }
            if (skippedTooBig.length > 0) {
              said.push(
                `Pominięte, bo są za duże na przeszukanie: ${skippedTooBig.length} ` +
                  `(${few(skippedTooBig)}). Jeśli odpowiedź ma być w którymś z nich, ` +
                  "otwórz go czynnością read_file.",
              )
            }
            if (skippedUnopened.length > 0) {
              said.push(
                `Pominięte, bo nie dało się ich otworzyć: ${skippedUnopened.length} ` +
                  `(${few(skippedUnopened)}).`,
              )
            }

            return {
              summary,
              answer: said.join("\n\n"),
              // Pliki, których fragment NAPRAWDĘ wszedł do tej odpowiedzi — i tylko one.
              // To one weszły do kontekstu modelu, więc to one mają stać w „Co weszło”.
              discovered: { matched },
            }
          },
        )
      },
    })
  }

  if (hasCapability(p, "document.read")) {
    /**
     * OSOBNA CZYNNOŚĆ, nie gałąź w `read_file` (ADR-0001 §8). `read_file` czyta bajty
     * z dysku; ta prosi usługę, żeby narysowała strony i pokazała je modelowi wizyjnemu.
     * Wynik jest tekstem modelu — a cały ten produkt stoi na zdaniu, że dowód nigdy
     * z tekstu modelu nie pochodzi. Schowanie obu pod jedną kartą znaczyłoby, że
     * ta różnica przestaje być widoczna dokładnie tam, gdzie ma być widoczna najbardziej.
     */
    t.read_document = tool({
      description:
        "Odczytuje dokument, którego nie da się przeczytać jako tekst: PDF, skan, zdjęcie " +
        "dokumentu, plik Worda, Excela albo prezentację. Strony są ROZPOZNAWANE przez model " +
        "z obrazu, więc wynik jest odczytem, a nie dosłowną treścią pliku — kwoty i numery " +
        "traktuj jako do sprawdzenia i nigdy nie twierdź, że cytujesz plik dosłownie. " +
        "Do plików tekstowych (txt, csv, md) używaj read_file — są tańsze i pewne.",
      inputSchema: z.object({ path: z.string().describe('np. "Moje pliki/faktura-08.pdf"') }),
      execute: async ({ path }) =>
        step("read_document", `Rozpoznaję ${path}`, { path }, async () => {
          // Plik tekstowy odbijamy PRZED wywołaniem usługi: rozpoznawanie kosztuje
          // pieniądze i oddaje domysł tam, gdzie `read_file` oddaje pewność.
          if (!isRecognisable(path)) {
            return {
              ok: false,
              summary: "to nie jest dokument do rozpoznania",
              reason: "wrong-kind",
              answer:
                `Pliku ${path} nie ma po co rozpoznawać. Jeśli to zwykły tekst, arkusz CSV ` +
                "albo markdown — przeczytaj go czynnością read_file. Jeśli to archiwum albo " +
                "program, nie da się z niego nic odczytać.",
            }
          }
          const nie = refuseShared(may, path, "read")
          if (nie)
            return {
              ok: false,
              summary: "brak dostępu do wspólnej półki",
              reason: "no-access",
              answer: nie,
            }

          let bytes: Buffer
          try {
            bytes = await storage.readBinary(u.id, path)
          } catch {
            return {
              ok: false,
              summary: "nie udało się otworzyć",
              reason: "cannot-open",
              answer: `Nie udało się otworzyć pliku ${path}.`,
            }
          }

          const name = path.split("/").pop() ?? path
          try {
            const recognised = await recogniseDocument({
              fileName: name,
              bytes,
              // Rejestr cortex-proxy to księga dla audytora — ma widzieć osobę, nie usługę.
              user: u.id,
            })
            return {
              // Liczba stron NIE jest ozdobą: to jedyne miejsce, w którym człowiek zobaczy,
              // że usługa przetworzyła sam początek długiego dokumentu.
              summary: recognitionSummary(recognised),
              answer: recognitionAnswer(name, recognised),
            }
          } catch (e) {
            // Awaria usługi zamyka krok jak każda inna — para zdarzeń domyka się w `step`,
            // ale dowód ma powiedzieć CO się zepsuło, a nie tylko że się nie udało.
            const why = e instanceof DocumentParserFailure ? e.message : String(e).slice(0, 120)
            return {
              ok: false,
              summary: `nie udało się rozpoznać — ${why}`,
              reason: "cannot-recognise",
              answer:
                `Nie udało się rozpoznać dokumentu ${name}: ${why}. Powiedz o tym człowiekowi ` +
                "i zaproponuj wersję tekstową albo wklejenie potrzebnego fragmentu.",
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
              reason: "no-such-file",
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
        // Podfolder może wskazać wspólną półkę — wtedy to nie jest „moje", tylko firmowe,
        // i decyduje o tym inna zdolność.
        const wanted = folder?.trim() ?? ""
        const target = isShared(wanted)
          ? `${wanted}/${name}`
          : wanted
            ? `Moje pliki/${wanted}/${name}`
            : `Moje pliki/${name}`
        return step(
          "save_to_my_files",
          `Odkładam ${name} do Moich plików`,
          { name, target },
          async () => {
            const nie = refuseShared(may, target, "write")
            if (nie)
              return {
                ok: false,
                summary: "brak zgody na wspólną półkę",
                reason: "no-access",
                answer: nie,
              }
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
                reason: "cannot-save",
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

  /**
   * OTWARCIE PROCEDURY FIRMOWEJ — rejestrowana ZAWSZE, bez własnej zdolności.
   *
   * ADR-0001 §7 mówi, że nowa zdolność powstaje tylko wtedy, gdy przechodzi OBA testy.
   * Test wiersza tu przechodzi (pracownik ma widzieć, że asystent zna zasady firmy),
   * ale test rozłączności NIE: nie istnieje sytuacja, w której ktoś ma czytać własne pliki,
   * a nie ma znać zasad, według których się w tej firmie pracuje. Odebranie tego znaczyłoby
   * „pracuj wbrew regulaminowi". Katalog zdolności zostaje więc zamknięty na trzynastu,
   * a o tym, KTÓRA procedura wchodzi, decyduje jej zasięg — nie czy w ogóle.
   */
  t.open_procedure = tool({
    description:
      "Otwiera spisaną zasadę firmy i oddaje jej treść. Podaj `name` z listy procedur " +
      "wymienionej w Twoich instrukcjach. Otwórz procedurę ZANIM wykonasz zadanie, " +
      "którego dotyczy — jej treść jest ważniejsza od Twoich domysłów o tym, jak się to robi.",
    inputSchema: z.object({
      name: z.string().describe("identyfikator procedury, np. zestawienie-vat"),
    }),
    execute: async ({ name }) =>
      step("open_procedure", name, { name }, async () => {
        /**
         * DRUGIE SPRAWDZENIE ZASIĘGU, choć filtr działa już na odkryciu (procedura spoza
         * zasięgu nie wchodzi do indeksu). To nie jest nadmiarowość: model dostaje nazwę
         * jako NAPIS, a napis da się zgadnąć albo przenieść ze starej sprawy. Odmowa jest
         * wtedy ZDARZENIEM i zostawia ślad; cisza by go nie zostawiła.
         */
        const found = procedures.find((one) => one.name === name)
        if (!found) {
          return {
            ok: false,
            reason: "no-such-procedure",
            summary: `nie ma procedury ${name}`,
            answer:
              `Nie ma procedury o nazwie „${name}" wśród tych, które obowiązują tę osobę. ` +
              "Nie zgaduj jej treści — jeśli uważasz, że taka zasada powinna istnieć, " +
              "zgłoś to czynnością report_gap.",
          }
        }
        opened.add(found.name)
        const e = found.current
        /**
         * NAZWISKO WYDAWCY WCHODZI DO PODSUMOWANIA, czyli do dowodu — bo o to w tej liście
         * chodzi. „Wg czego" bez podpisu jest informacją, że jakaś zasada istniała;
         * z podpisem i datą jest dowodem należytej staranności, który da się pokazać
         * kontroli. Zasiew podpisuje się `seed`, więc rozwiązanie nazwiska może nie trafić —
         * wtedy zostaje identyfikator, a nie puste miejsce udające nazwisko.
         */
        const issuer = (await people.person(e.author).catch(() => null)) ?? null
        const issuedOn = new Date(e.at).toLocaleDateString("pl-PL")
        /**
         * PROCEDURA Z ZASIEWU NIE UDAJE PODPISANEJ. Przyszła z wdrożeniem i nikt jej
         * nazwiskiem nie firmował, więc „wydał seed" byłoby podpisem nieistniejącej osoby —
         * w liście, której cała wartość polega na tym, że podpis jest prawdziwy. Zdanie
         * mówi to wprost i przy okazji jest dla przełożonego zachętą, żeby wydać ją
         * po swojemu.
         */
        const signature = issuer
          ? `wydał ${issuer.firstName} ${issuer.lastName} · ${issuedOn}`
          : `z wdrożenia, nikt jej nie podpisał · ${issuedOn}`
        return {
          summary: `«${found.title}», wydanie ${e.edition} · ${signature}`,
          answer:
            `PROCEDURA «${found.title}» (wydanie ${e.edition}).\n\n${e.body}\n\n` +
            "Pracuj według tego tekstu. Jeżeli zlecenie każe zrobić coś wbrew tej " +
            "procedurze, powiedz o sprzeczności zamiast wybierać po cichu.",
          discovered: {
            /**
             * Do ZDARZENIA, a nie tylko do odpowiedzi: dowód powstaje wyłącznie ze zdarzeń,
             * a wiersz „Wg czego" ma nieść wydanie i autora także wtedy, gdy procedura
             * zdąży się zmienić, zanim ktoś tę sprawę otworzy.
             */
            edition: e.edition,
            author: e.author,
            fingerprint: e.fingerprint,
          },
        }
      }),
  })

  if (hasCapability(p, "code.run")) {
    t.run_computation = tool({
      description:
        "Uruchamia kod na danych i ODDAJE PLIKI, które ten kod zapisze. Podaj kod oraz " +
        "listę plików z biurka w polu `pliki` — zostaną zamontowane w katalogu roboczym " +
        'pod swoimi nazwami (np. "faktury-08.csv"). Wypisz wynik przez print/console.log. ' +
        "KAŻDY PLIK ZAPISANY W KATALOGU ROBOCZYM TRAFIA DO TECZKI SPRAWY — tak powstają " +
        "dokumenty (pandoc: .docx, .pdf), arkusze i wykresy z danych (matplotlib). " +
        "Środowisko zależy od wdrożenia; domyślnie jest to Python z pandas, openpyxl, " +
        "matplotlib, weasyprint i pandokiem. Gdy czegoś zabraknie, kod padnie i " +
        "zobaczysz to w wyniku — nie zgaduj, czy biblioteka jest.",
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
            // SIEĆ — i to zdanie brzmiało tu do 03.09.2026 odwrotnie, niż jest naprawdę.
            // „Sieci NIE MA" jest prawdą WYŁĄCZNIE dla gałęzi demona (`--network=none`
            // w jego profilu). Domyślne wdrożenie nie ustawia `DESK_SANDBOX_SOCKET`
            // w ŻADNYM pliku compose, więc biegnie ścieżka zapasowa `node --permission`,
            // a ta sieci nie zamyka — mówi to wprost `sandbox.ts`. Zdanie o zamkniętej
            // sieci czytane w tym pliku wystarczyło, żeby przyznać `code.run` z czystym
            // sumieniem; dlatego stoi tu teraz cała prawda, a nie jej lepsza połowa.
          })
          // `finally` przy sprzątaniu piaskownicy, bo wyjątek w `exec` zostawiał
          // katalog i proces bez właściciela — a piaskownica ma po sobie sprzątać
          // także wtedy, gdy to ona jest przyczyną awarii.
          try {
            const r = await box.exec(code)
            // „Za duże" to nie to samo co „nie udało się" — i człowiek ma zobaczyć różnicę.
            // Bez tego rozróżnienia obliczenie ucięte na suficie wygląda w dowodzie
            // dokładnie tak samo jak kod, który rzucił wyjątkiem.
            const why: Record<string, string> = {
              timeout: "obliczenie trwało za długo",
              memory: "obliczenie potrzebowało za dużo pamięci",
              processes: "obliczenie uruchomiło za dużo procesów",
              output: "wynik był za duży i został ucięty",
            }
            const stopped = r.stopped ? (why[r.stopped] ?? "obliczenie zostało zatrzymane") : ""
            // Gdy kod padł, do dowodu idzie POWÓD, a nie sama informacja, że padł.
            // Bez tego jedyną wiedzą człowieka było „błąd wykonania", a treść błędu
            // szła do modelu i przepadała.
            const reason = r.ok ? "" : sandboxFailureLine(r.output)
            // Powód rozróżnia dwie rzeczy, które dla człowieka mają RÓŻNE wyjścia: kod,
            // który się przewrócił (opisz zlecenie dokładniej), i obliczenie oparte
            // o sufit (poproś o mniejszą porcję). Sufit ma pierwszeństwo, bo to on
            // jest prawdziwą przyczyną, gdy oba zaszły naraz.
            const failure: StepFailure | undefined = r.stopped
              ? "computation-stopped"
              : r.ok
                ? undefined
                : "computation-error"

            // PLIKI WYCHODZĄ Z PIASKOWNICY, i to jest cała różnica między „umiem policzyć"
            // a „umiem zrobić dokument". Do 03.09.2026 lista `produced` docierała aż tutaj
            // i się kończyła: kod mógł złożyć arkusz albo narysować wykres, po czym plik
            // ginął razem z katalogiem przy `dispose()` w `finally`. Zabieramy je PRZED
            // sprzątaniem — potem nie ma już czego zabierać.
            //
            // Zabieramy TAKŻE po nieudanym obliczeniu: skrypt, który zapisał trzy z pięciu
            // arkuszy i przewrócił się na czwartym, zostawił trzy prawdziwe pliki. Wyrzucenie
            // ich dlatego, że tura skończyła się źle, byłoby karą za cudzy błąd.
            const got = await box.collect(caseFolder, r.produced).catch(() => null)
            const made = got?.kept ?? []
            const lost = got?.skipped ?? []

            const saidAboutFiles: string[] = []
            if (made.length > 0) {
              saidAboutFiles.push(
                `W teczce sprawy powstały pliki: ${made.map((one) => path.basename(one)).join(", ")}.`,
              )
            }
            if (lost.length > 0) {
              // Cicha strata pliku jest gorsza niż jego brak: człowiek przeczytałby
              // w wyjściu „zapisano wykres" i nie znalazłby go u siebie.
              saidAboutFiles.push(
                `NIE UDAŁO SIĘ zabrać ${lost.length} plików (${lost
                  .map((one) => `${path.basename(one.name)} — ${one.why}`)
                  .join(", ")}). Powiedz o tym człowiekowi, nie przemilczaj.`,
              )
            }

            return {
              ok: r.ok,
              summary:
                stopped ||
                (r.ok
                  ? made.length > 0
                    ? `policzone, plików: ${made.length}`
                    : "policzone"
                  : reason
                    ? `błąd wykonania — ${reason}`
                    : "błąd wykonania"),
              ...(failure === undefined ? {} : { reason: failure }),
              answer: [r.output || "(brak wyjścia)", ...saidAboutFiles].join("\n\n"),
              // NAZWY WYTWORZONYCH PLIKÓW IDĄ DO ZDARZENIA, nie tylko do modelu.
              //
              // Do 03.09.2026 stało tu `produced: made` — a `produced` NIE JEST polem
              // `StepResult`. Rozsypanie omija sprawdzanie nadmiarowych pól, więc `tsc`
              // milczał i linia nie publikowała niczego. Nazwy docierały do modelu przez
              // `answer` i nigdzie indziej; w „Co powstało" stał jeden wiersz „policzone,
              // plików: 4" — liczba bez nazw, w którą nie da się kliknąć. Pilnuje tego
              // teraz `step-result-shape.test.ts`, bo kompilator tej klasy błędu nie widzi.
              //
              // Nazwy BAZOWE, nie ścieżki: `collect()` oddaje ścieżki logiczne w teczce
              // sprawy, a w dowodzie rzeczą jest plik. Ścieżkę zna karta artefaktu.
              ...(made.length > 0
                ? { discovered: { made: made.map((one) => path.basename(one)) } }
                : {}),
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
                reason: "outside-service",
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

  /**
   * PROCEDURY FIRMY — filtrowane zasięgiem PRZED wejściem do tury, nie odmawiane po fakcie.
   * Ten sam wzorzec, co przy zdolnościach: czego nie ma w indeksie, o to model nie poprosi.
   */
  const procedures = visibleFor(await activeProcedures(), u.department)
  // Składanie bloku siedzi w `prompt-block.ts` — ten sam wzorzec, co przy pamięci, i z tego
  // samego powodu: da się je sprawdzić bez wołania modelu.
  const block = promptBlock(procedures)

  await audit.write(u.id, "turn.start", {
    caseId,
    fingerprint: p.fingerprint,
    capabilities: p.granted.map((z) => z.id),
    remembered: remembered.map((m) => m.id),
    /**
     * Procedury dopisujemy do ISTNIEJĄCEGO wpisu, a nie osobnym zdarzeniem co turę.
     * Osobne zdarzenie podwajałoby liczbę wierszy w dzienniku bez ani jednej nowej
     * decyzji do obejrzenia — a dziennik czyta się wtedy, gdy się czegoś szuka.
     *
     * NAZWY I WYDANIA, nigdy treść: przełożony ma widzieć, według czego pracowano,
     * a treść czyta na ekranie procedury. Ta sama reguła, co przy pamięci.
     */
    procedures: procedures.map((one) => `${one.name}@${one.current.edition}`),
    // Rachunek płacony w KAŻDEJ turze. Bez tej liczby tryb `always` jest wydatkiem,
    // którego nikt nie widzi, dopóki nie przyjdzie faktura za miesiąc.
    alwaysChars: block.alwaysChars,
  })

  // Szew MCP jest prawdziwy od tego commita, choć katalog serwerów jest pusty.
  // Narzędzia z zatwierdzonych serwerów przechodzą przez TĘ SAMĄ bramę zdolności
  // i ten sam filtr na odkryciu, co wbudowane — inaczej byłaby to druga furtka.
  const mcp = await mcpTools(p, (e) => appendEvent(caseId, e))
  const tools = { ...toolsForPolicy(u, p, caseId, procedures), ...mcp.tools }

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

  const procedureText = block.text === "" ? "" : `\n\n${block.text}`

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
        // DOKTRYNA + PROCEDURY + PAMIĘĆ, w tej kolejności i z tego powodu: doktryna jest
        // kodem i klient nie ma do niej dostępu, procedury są tekstem firmy, pamięć jest
        // tekstem tej jednej osoby. Im bliżej końca, tym węższy zasięg.
        system: `${SYSTEM}\n\nUżytkownik: ${u.firstName} ${u.lastName}, dział ${u.department}. Teczka bieżącej sprawy: ${storage.caseFolder(u.id, caseId)}.${procedureText}${recalled}`,
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

const CAPABILITY_HINTS: Record<string, RegExp> = {
  "sheet.write": /arkusz|excel|xlsx|spreadsheet|csv|tabel/i,
  "code.run": /policz|oblicz|przelicz|wykres|skrypt|kod|statystyk/i,
  "image.generate": /obraz|grafik|rysun|ilustrac|zdjęci|wygeneruj.*obraz/i,
  "files.keep": /moich plik|do moich|trwal/i,
  "document.write": /zapisa.*dokument|utworzy.*plik/i,
  "files.read": /przeczyta|odczyta|otworzy.*plik/i,
  // Bez „odczytać" i „przeczytać" w tym wzorcu, choć pasowałyby: dopasowanie bierze
  // PIERWSZĄ pasującą zablokowaną zdolność w kolejności katalogu, a tam `files.read`
  // stoi wyżej i łapie oba te czasowniki. Rozróżnia się je nośnikiem — PDF, skan, Word.
  "document.read": /pdf|skan|zeskan|rozpozna|ocr|word|docx|zdjęci.*(faktur|dokument)/i,
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
