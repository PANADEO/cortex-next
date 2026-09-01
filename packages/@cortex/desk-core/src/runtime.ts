import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import * as audit from "./audit-log"
import { hasCapability } from "./capability-gate"
import { migrate, pool } from "./db"
import * as storage from "./desk-storage"
import { readableFailure } from "./failure"
import { mcpTools } from "./mcp/client"
import * as sandbox from "./sandbox"
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

export function toolsForPolicy(u: User, p: Policy, caseId: string) {
  const caseFolder = storage.caseFolder(u.id, caseId)
  const emit = (e: DeskEvent) => appendEvent(caseId, e)
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
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "list_files",
          label: `Przeglądam „${k}”`,
          args: { folder: k },
        })
        const l = await storage.list(u.id, k)
        const caseEntries = await storage.list(u.id, caseFolder).catch(() => [])
        const description =
          [
            ...l.map((x) => `${x.folder ? "[katalog] " : ""}${x.path} (${x.size} B)`),
            ...caseEntries.map((x) => `${x.path} (${x.size} B)`),
          ].join("\n") || "(pusto)"
        await emit({
          type: "tool_end",
          id: kid,
          name: "list_files",
          ok: true,
          summary: `${l.length + caseEntries.length} pozycji`,
          ms: Date.now() - start,
        })
        return description
      },
    })
  }

  if (hasCapability(p, "files.read")) {
    t.read_file = tool({
      description: "Czyta zawartość pliku tekstowego z biurka użytkownika.",
      inputSchema: z.object({ path: z.string().describe('np. "Moje pliki/faktury-08.csv"') }),
      execute: async ({ path }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "read_file",
          label: `Czytam ${path}`,
          args: { path },
        })
        // Bez tego readFile(utf8) na .jpg zwraca śmieci z ok:true i wpisuje je do dowodu
        // jako „odczytany plik" — czyli dowód poświadcza coś, czego nie było.
        const notText = notReadable(path)
        if (notText) {
          await emit({
            type: "tool_end",
            id: kid,
            name: "read_file",
            ok: false,
            summary: "to nie jest plik tekstowy",
            ms: Date.now() - start,
          })
          return notText
        }
        try {
          const text = await storage.read(u.id, path)
          const lines = text.split("\n").length
          await emit({
            type: "tool_end",
            id: kid,
            name: "read_file",
            ok: true,
            summary: `${lines} wierszy, ${text.length} znaków`,
            ms: Date.now() - start,
          })
          return text.slice(0, 60000)
        } catch {
          await emit({
            type: "tool_end",
            id: kid,
            name: "read_file",
            ok: false,
            summary: "nie udało się otworzyć",
            ms: Date.now() - start,
          })
          return `Nie udało się otworzyć pliku ${path}.`
        }
      },
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
      execute: async ({ name, text }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "write_document",
          label: `Zapisuję ${name}`,
          args: { name },
        })
        await storage.write(u.id, `${caseFolder}/${name}`, text)
        await emit({
          type: "tool_end",
          id: kid,
          name: "write_document",
          ok: true,
          summary: `${text.length} znaków`,
          ms: Date.now() - start,
        })
        return `Zapisano ${name} w teczce sprawy.`
      },
    })
  }

  if (hasCapability(p, "document.verify")) {
    t.verify_document = tool({
      description:
        "Odczytuje zapisany dokument z teczki sprawy, żeby potwierdzić, co w nim faktycznie jest.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "verify_document",
          label: `Sprawdzam ${name} po zapisie`,
          args: { name },
        })
        try {
          const text = await storage.read(u.id, `${caseFolder}/${name}`)
          const empty = (text.match(/\[(WPISZ|UZUPEŁNIJ|TODO)[^\]]*\]/gi) ?? []).length
          await emit({
            type: "tool_end",
            id: kid,
            name: "verify_document",
            ok: true,
            summary: `${text.split("\n").length} wierszy, pustych pól: ${empty}`,
            ms: Date.now() - start,
          })
          return `Plik ma ${text.length} znaków. Nieuzupełnionych pól: ${empty}.\n\n${text.slice(0, 4000)}`
        } catch {
          await emit({
            type: "tool_end",
            id: kid,
            name: "verify_document",
            ok: false,
            summary: "pliku nie ma",
            ms: Date.now() - start,
          })
          return `Pliku ${name} nie ma w teczce sprawy.`
        }
      },
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
        const start = Date.now(),
          kid = randomUUID()
        const target = folder?.trim() ? `Moje pliki/${folder.trim()}/${name}` : `Moje pliki/${name}`
        await emit({
          type: "tool_start",
          id: kid,
          name: "save_to_my_files",
          label: `Odkładam ${name} do Moich plików`,
          args: { name, target },
        })
        try {
          const stored = await storage.copy(u.id, `${caseFolder}/${name}`, target)
          await emit({
            type: "tool_end",
            id: kid,
            name: "save_to_my_files",
            ok: true,
            summary: stored,
            ms: Date.now() - start,
          })
          return `Plik jest teraz w „Moich plikach" jako ${stored}.`
        } catch (e) {
          await emit({
            type: "tool_end",
            id: kid,
            name: "save_to_my_files",
            ok: false,
            summary: "nie udało się odłożyć",
            ms: Date.now() - start,
          })
          return `Nie udało się odłożyć pliku ${name} do Moich plików. ${String(e).slice(0, 120)}`
        }
      },
    })
  }

  if (hasCapability(p, "sheet.write")) {
    t.write_sheet = tool({
      description: "Zapisuje zestawienie jako arkusz CSV do teczki sprawy.",
      inputSchema: z.object({ name: z.string(), csv: z.string() }),
      execute: async ({ name, csv }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "write_sheet",
          label: `Zapisuję arkusz ${name}`,
          args: { name },
        })
        await storage.write(u.id, `${caseFolder}/${name}`, csv)
        await emit({
          type: "tool_end",
          id: kid,
          name: "write_sheet",
          ok: true,
          summary: `${csv.split("\n").length} wierszy`,
          ms: Date.now() - start,
        })
        return `Zapisano arkusz ${name}.`
      },
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
      execute: async ({ description, code, files }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "run_computation",
          label: description,
          args: { description },
        })
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
        const r = await box.exec(code)
        await box.dispose()
        await emit({
          type: "tool_end",
          id: kid,
          name: "run_computation",
          ok: r.ok,
          summary: r.ok ? "policzone" : "błąd wykonania",
          ms: Date.now() - start,
        })
        return r.output || "(brak wyjścia)"
      },
    })
  }

  if (hasCapability(p, "image.generate")) {
    t.generate_image = tool({
      description: "Generuje obraz na podstawie opisu i zapisuje go w teczce sprawy.",
      inputSchema: z.object({
        name: z.string().describe('np. "grafika.png"'),
        description: z.string(),
      }),
      execute: async ({ name, description }) => {
        const start = Date.now(),
          kid = randomUUID()
        await emit({
          type: "tool_start",
          id: kid,
          name: "generate_image",
          label: `Generuję obraz: ${description.slice(0, 60)}`,
          args: { name, description },
        })
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
          await emit({
            type: "tool_end",
            id: kid,
            name: "generate_image",
            ok: true,
            summary: `zapisano ${name}`,
            ms: Date.now() - start,
          })
          return `Obraz zapisany jako ${name}.`
        } catch (e) {
          await emit({
            type: "tool_end",
            id: kid,
            name: "generate_image",
            ok: false,
            summary: String(e).slice(0, 120),
            ms: Date.now() - start,
          })
          const m = String(e)
          const readably = /modalit|not a valid model|404/i.test(m)
            ? "Na tej instancji nie ma podłączonego modelu graficznego — administrator musi go udostępnić w cortex-proxy."
            : m.slice(0, 200)
          return `Nie udało się wygenerować obrazu. ${readably}`
        }
      },
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
  await audit.write(u.id, "turn.start", {
    caseId,
    fingerprint: p.fingerprint,
    capabilities: p.granted.map((z) => z.id),
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

  void (async () => {
    try {
      const result = await generateText({
        model: model(u.id),
        system: `${SYSTEM}\n\nUżytkownik: ${u.firstName} ${u.lastName}, dział ${u.department}. Teczka bieżącej sprawy: ${storage.caseFolder(u.id, caseId)}.`,
        messages: messages,
        tools: tools,
        stopWhen: stepCountIs(12),
        maxOutputTokens: OUTPUT_CEILING,
      })

      // Rzutowanie na wspólny kształt: `GenerateTextResult` ma własne, węższe typy metadanych
      // dostawcy, a `turnCost` interesuje wyłącznie jedno pole, którego tamte nie deklarują,
      // bo wstawia je nasz `metadataExtractor`.
      const cost = turnCost(result as unknown as TurnResult)
      if (result.text?.trim())
        await appendEvent(caseId, { type: "assistant", text: result.text.trim() })
      if (cost.usd > 0)
        await appendEvent(caseId, { type: "cost", usd: cost.usd, basis: cost.basis })
      await appendEvent(caseId, { type: "lifecycle", status: "end" })
      await pool.query(
        `update desk.case_file set status='done', reason=null, cost_usd=cost_usd+$2, updated_at=now() where id=$1`,
        [caseId, cost.usd],
      )
      await audit.write(u.id, "turn.end", {
        caseId,
        costUsd: cost.usd,
        costBasis: cost.basis,
      })
    } catch (e) {
      const reason = readableFailure(e)
      await appendEvent(caseId, { type: "lifecycle", status: "failed", reason })
      await pool.query(
        `update desk.case_file set status='failed', reason=$2, updated_at=now() where id=$1`,
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
