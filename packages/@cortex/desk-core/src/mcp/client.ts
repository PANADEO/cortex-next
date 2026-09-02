import { experimental_createMCPClient } from "@ai-sdk/mcp"
import type { ToolSet } from "ai"
import { jsonSchema, tool } from "ai"
import { randomUUID } from "node:crypto"
import "server-only"
import { hasCapability } from "../capability-gate"
import { registerCard } from "../tool-cards"
import type { DeskEvent, Policy } from "../types"
import { serverCatalogue, suspendTool } from "./catalogue-store"
import { fingerprint, sanitiseSchema, SchemaRejected, toolKey } from "./hygiene"
import {
  CALL_DEADLINE_MS,
  clipResult,
  INSPECT_DEADLINE_MS,
  NoAnswerInTime,
  RESULT_CEILING,
  withDeadline,
} from "./limits"
import { AddressNotAllowed, assertAllowedAddress } from "./server-address"
export type { ApprovedTool, McpServer } from "./catalogue"

/**
 * KLIENT MCP — jedyne miejsce w kodzie, które wie, że MCP w ogóle istnieje.
 * Ta sama dyscyplina, co z biblioteką agentową w `runtime.ts`: na zewnątrz wychodzą
 * wyłącznie nasze `DeskEvent` i nasze narzędzia.
 *
 * Na tym etapie katalog serwerów jest PUSTY i to jest celowe. Zależność wchodzi
 * osobnym krokiem, przed pierwszym serwerem — inaczej przy pierwszej regresji
 * nie dałoby się odróżnić awarii harnessu od awarii integracji.
 */

export class ToolDrift extends Error {}

/**
 * Buduje narzędzia z zatwierdzonych serwerów. Cztery rzeczy dzieją się tu naraz
 * i żadnej nie wolno pominąć:
 *
 * 1. `tools({ schemas })` z mapą pinowaną PO NASZEJ STRONIE. Domyślne `'automatic'`
 *    zaciągnęłoby każde narzędzie, które serwer akurat wystawia — czyli nowe narzędzie
 *    pojawiłoby się u pani Basi samo, bez niczyjej zgody.
 * 2. Opis widziany przez model pochodzi od zatwierdzającego, nie z serwera.
 * 3. Odcisk sprawdzany przy każdej rejestracji, fail-closed.
 * 4. Zdarzenia `narzedzie_start`/`narzedzie_koniec` emituje NASZ kod, nie SDK —
 *    bo na nich stoi cały dowód.
 */
export type McpTools = {
  // `ToolSet`, nie `Record<string, unknown>`: narzędzia z obcego serwera wchodzą do tego
  // samego worka co wbudowane i muszą mieć ten sam kształt — inaczej niezgodność wychodzi
  // dopiero jako odmowa dostawcy w środku tury.
  tools: ToolSet
  /**
   * Klienci MUSZĄ żyć do końca tury. Zamknięcie ich zaraz po rejestracji wygląda
   * na porządek, a kończy się „Attempted to send a request from a closed client"
   * przy pierwszym wywołaniu — bo model sięga po narzędzie dopiero w `generateText`.
   */
  close: () => Promise<void>
}

export async function mcpTools(
  p: Policy,
  emit: (e: DeskEvent) => Promise<void>,
): Promise<McpTools> {
  const result: ToolSet = {}
  const openItems: { close: () => Promise<void> }[] = []

  for (const server of await serverCatalogue()) {
    // FILTR NA ODKRYCIU obowiązuje tak samo jak dla wbudowanych: narzędzie, którego
    // ta osoba nie ma przyznanego, nie jest rejestrowane — model go nie widzi.
    const allowed = server.tools.filter((n) => hasCapability(p, n.capabilityId))
    if (!allowed.length) continue

    let client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null = null
    try {
      // ADRES SPRAWDZAMY, ZANIM POLECI PIERWSZE ŻĄDANIE. `experimental_createMCPClient`
      // nawiązuje połączenie i wysyła `initialize` już w konstruktorze, więc sprawdzenie
      // postawione choćby wiersz niżej byłoby sprawdzeniem PO fakcie.
      assertAllowedAddress(server.url)
      client = await experimental_createMCPClient({
        // Streamable HTTP, nigdy stdio: stdio w aplikacji webowej to nie transport,
        // tylko uruchomienie obcego binarium z uprawnieniami procesu Node.
        transport: { type: "http", url: server.url },
      })
      openItems.push(client)
      const remote = await client.tools({ schemas: "automatic" })

      for (const n of allowed) {
        const raw = (remote as Record<string, { inputSchema?: unknown }>)[n.remoteName]
        if (!raw) throw new ToolDrift(`Serwer ${server.name} nie wystawia już ${n.remoteName}.`)

        // AI SDK opakowuje schemat w obiekt `Schema` — do odcisku i do rejestracji
        // bierzemy TREŚĆ, nie opakowanie, bo to ona jest kontraktem narzędzia.
        const rawJson = (raw.inputSchema as { jsonSchema?: unknown })?.jsonSchema ?? raw.inputSchema
        const schema = sanitiseSchema(rawJson)
        const now = fingerprint(server.name, n.remoteName, n.description, schema)
        if (now !== n.fingerprint) {
          // Wstrzymujemy POJEDYNCZE narzędzie i lecimy dalej: jedno zdryfowane nie ma prawa
          // odciąć pozostałych, które człowiek zatwierdził i które się nie zmieniły.
          const reason = `Serwer zmienił to narzędzie po zatwierdzeniu (fingerprint ${n.fingerprint.slice(0, 8)}… → ${now.slice(0, 8)}…).`
          await suspendTool(server.name, n.remoteName, reason)
          await emit({
            type: "blocked",
            description: `${n.shortLabel} — ${reason} Czynność czeka na ponowną zgodę przełożonego.`,
          })
          continue
        }

        const key = toolKey(server.name, n.remoteName)
        registerCard({
          name: key,
          kind: "external",
          source: server.name,
          running: "tools.external.running",
          ok: "tools.external.ok",
          group: {
            key: `external:${server.name}`,
            phrase: "tools.groups.external",
            weight: 4,
          },
          evidence: {
            list: "intake",
            phrase: "tools.evidence.externalNamed",
            phraseBare: "tools.evidence.externalNamedBare",
          },
          // Nazwa serwera i opis narzędzia to WARTOŚCI wpisane przez zatwierdzającego,
          // nie części klucza — jadą jako zmienne do zdania ze słownika.
          vars: { server: server.label, tool: n.description },
        })

        result[key] = tool({
          description: n.description,
          inputSchema: jsonSchema(schema as Record<string, unknown>),
          execute: async (args: unknown) => {
            const start = Date.now(),
              kid = randomUUID()
            await emit({
              type: "tool_start",
              id: kid,
              name: key,
              label: n.shortLabel,
              source: server.label,
              args: args as Record<string, unknown>,
            })
            // `tool_end` leci z `finally`, tak samo jak w opakowywaczu `step()` wbudowanych
            // czynności. Para musi domknąć się TAKŻE przy odrzuconym adresie i przy ciszy
            // serwera — krok bez `tool_end` wisi na ekranie „w toku" na zawsze i wypada
            // z dowodu, a dowód powstaje wyłącznie ze zdarzeń.
            let end = { ok: false, summary: "przerwane" }
            let answer: unknown = "Czynność nie doszła do skutku."
            let failure: { thrown: unknown } | null = null
            try {
              // Sprawdzenie POWTÓRZONE w chwili wywołania, a nie tylko przy rejestracji:
              // bramka ma siedzieć na ścieżce, która naprawdę otwiera gniazdo.
              assertAllowedAddress(server.url)
              const raced = await withDeadline(
                CALL_DEADLINE_MS,
                (raw as { execute: (a: unknown) => Promise<unknown> }).execute(args),
              )
              if (raced.late) {
                // Zdanie po ludzku, nie surowy błąd — ten sam ton, co `step()`: dowód mówi,
                // że się NIE udało, a model dostaje zdanie, z którym da się coś zrobić.
                end = {
                  ok: false,
                  summary: `serwer nie odpowiedział w ciągu ${CALL_DEADLINE_MS / 1000} s`,
                }
                answer =
                  `Serwer ${server.label} nie odpowiedział w ciągu ${CALL_DEADLINE_MS / 1000} sekund. ` +
                  "Nie wiadomo, czy po jego stronie cokolwiek się wydarzyło — powiedz to człowiekowi " +
                  "wprost i nie zakładaj żadnego wyniku."
              } else {
                const clipped = clipResult(raced.value)
                // „serwer odpowiedział" to NIE to samo co „rzecz się wydarzyła" — stąd wiersz
                // dowodu idzie do „Co weszło", a nie do „Co zrobione". Decyduje o tym karta wyżej.
                end = {
                  ok: true,
                  summary: clipped.clipped
                    ? `serwer odpowiedział, wynik obcięty do ${RESULT_CEILING} znaków z ${clipped.length}`
                    : "serwer odpowiedział",
                }
                answer = clipped.value
              }
            } catch (e) {
              if (e instanceof AddressNotAllowed) {
                end = { ok: false, summary: "adres serwera nie jest dozwolony" }
                answer = `${e.message} Powiedz o tym człowiekowi — adres serwera ustawia przełożony.`
              } else {
                end = { ok: false, summary: String(e).slice(0, 120) }
                failure = { thrown: e }
              }
            } finally {
              await emit({ type: "tool_end", id: kid, name: key, ...end, ms: Date.now() - start })
            }
            if (failure) throw failure.thrown
            return answer
          },
        })
      }
    } catch (e) {
      // Martwy albo zdryfowany serwer NIE jest po cichu pomijany. Dla agenta w tle
      // pominięcie byłoby poprawne; dla pani Basi to dokładnie ta patologia, przeciw
      // której zbudowano `report_gap` — zlecenie wychodzi gorzej i nikt nie wie dlaczego.
      await emit({
        type: "blocked",
        description:
          e instanceof ToolDrift || e instanceof SchemaRejected || e instanceof AddressNotAllowed
            ? e.message
            : `Nie udało się połączyć z ${server.name}.`,
      })
      // klient zostaje otwarty — zamknie go runtime po zakończeniu tury
    }
  }

  return {
    tools: result,
    close: async () => {
      for (const k of openItems) await k.close().catch(() => {})
    },
  }
}

export type ToolCandidate = {
  remoteName: string
  /** Schemat PO oczyszczeniu — to on wchodzi do odcisku i to on trafi do modelu. */
  schema: unknown
  fingerprintOf: (description: string) => string
  /**
   * SUROWY tekst napisany przez dostawcę serwera. Wolno go pokazać wyłącznie na ekranie
   * przyjmowania i wyłącznie pod etykietą mówiącą, czyj to tekst — nigdzie indziej i nigdy
   * modelowi. Jest tu po to, żeby zatwierdzający wiedział, co serwer o sobie twierdzi,
   * zanim napisze własny opis.
   */
  foreignDescription: string | null
  rejected: string | null
}

/**
 * Jedyne miejsce w aplikacji, które wykonuje `tools/list`. Nie rejestruje niczego —
 * zwraca kandydatów do obejrzenia przez człowieka.
 */
export async function inspectServer(url: string, name: string): Promise<ToolCandidate[]> {
  // PIERWSZA rzecz w tej funkcji, przed jakimkolwiek wyjściem na sieć. To tutaj wpisany
  // przed chwilą adres jest odpytywany po raz pierwszy — sprawdzenie postawione dopiero
  // przy rejestracji narzędzi byłoby sprawdzeniem po tym, jak kontener Biurka już poszedł
  // tam, gdzie mu kazano.
  assertAllowedAddress(url)
  // Uchwyt w pudełku, a nie w `let`: klienta trzeba zamknąć także wtedy, gdy zdążył
  // powstać, ale całość przekroczyła termin.
  const open: { client: Awaited<ReturnType<typeof experimental_createMCPClient>> | null } = {
    client: null,
  }
  try {
    const raced = await withDeadline(
      INSPECT_DEADLINE_MS,
      (async () => {
        open.client = await experimental_createMCPClient({ transport: { type: "http", url } })
        return open.client.tools({ schemas: "automatic" })
      })(),
    )
    if (raced.late) throw new NoAnswerInTime(INSPECT_DEADLINE_MS)
    const remote = raced.value
    return Object.entries(
      remote as Record<string, { inputSchema?: unknown; description?: string }>,
    ).map(([remoteName, def]) => {
      const rawJson = (def.inputSchema as { jsonSchema?: unknown })?.jsonSchema ?? def.inputSchema
      try {
        const schema = sanitiseSchema(rawJson)
        return {
          remoteName,
          schema,
          fingerprintOf: (description: string) =>
            fingerprint(name, remoteName, description, schema),
          foreignDescription: def.description ?? null,
          rejected: null,
        }
      } catch (e) {
        return {
          remoteName,
          schema: null,
          fingerprintOf: () => "",
          foreignDescription: def.description ?? null,
          rejected:
            e instanceof SchemaRejected ? e.message : "Nie umiem odczytać schematu tego narzędzia.",
        }
      }
    })
  } finally {
    await open.client?.close().catch(() => {})
  }
}
