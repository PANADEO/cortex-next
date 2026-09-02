// Klient MCP: bramka adresu, zegar i sufit — na ścieżce, która naprawdę otwiera gniazdo.
//
// DLACZEGO POWSTAŁ. `server-address.test.ts` i `limits.test.ts` sprawdzają REGUŁY. Ten plik
// sprawdza WPIĘCIE, bo trzy razy z rzędu byłoby to samo: reguła poprawna, a wołana za późno
// albo wcale. Konkretnie:
//
//  — `inspectServer` strzelał pod podany adres NATYCHMIAST, zanim cokolwiek zostało
//    zatwierdzone, więc sprawdzenie postawione przy rejestracji narzędzi byłoby
//    sprawdzeniem PO tym, jak kontener Biurka już tam poszedł;
//  — para `tool_start`/`tool_end` musi domknąć się TAKŻE przy odrzuconym adresie i przy
//    ciszy serwera. Dowód w tym produkcie powstaje wyłącznie ze zdarzeń — krok bez
//    `tool_end` wisi na ekranie „w toku" na zawsze i wypada z dowodu, bez błędu i bez logu.
//
// Serwera nie stawiamy: `@ai-sdk/mcp` jest podmieniony, a `wentTo` zapisuje KAŻDY adres,
// pod który klient naprawdę poszedł. Pusta lista jest tu asercją, nie brakiem asercji.

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, Policy } from "../types"

const fake = vi.hoisted(() => ({
  schema: { type: "object", properties: { text: { type: "string" } } } as Record<string, unknown>,
  wentTo: [] as string[],
  url: "http://mcp-test:8310/mcp",
  reply: async (): Promise<unknown> => ({ content: [{ type: "text", text: "czynny podatnik" }] }),
}))

vi.mock("server-only", () => ({}))

vi.mock("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: async ({ transport }: { transport: { url: string } }) => {
    fake.wentTo.push(transport.url)
    return {
      tools: async () => ({
        echo: {
          inputSchema: { jsonSchema: fake.schema },
          description: "TEKST DOSTAWCY, KTÓREGO MODEL NIE MA PRAWA ZOBACZYĆ",
          execute: async () => fake.reply(),
        },
      }),
      close: async () => {},
    }
  },
}))

const { fingerprint, toolKey } = await import("./hygiene")
const DESCRIPTION = "Sprawdza status VAT firmy o podanym NIP."

vi.mock("./catalogue-store", () => ({
  serverCatalogue: async () => [
    {
      name: "test-server",
      label: "serwer testowy",
      url: fake.url,
      tools: [
        {
          server: "test-server",
          remoteName: "echo",
          description: DESCRIPTION,
          shortLabel: "sprawdzenie statusu VAT",
          capabilityId: "counterparty.verify",
          fingerprint: fingerprint("test-server", "echo", DESCRIPTION, fake.schema),
        },
      ],
    },
  ],
  suspendTool: async () => {},
}))

vi.mock("../capability-gate", () => ({ hasCapability: () => true }))

const { mcpTools, inspectServer } = await import("./client")
const { CALL_DEADLINE_MS, RESULT_CEILING } = await import("./limits")
const { AddressNotAllowed } = await import("./server-address")

const KEY = toolKey("test-server", "echo")
const policy = { user: "anna", role: "member" } as unknown as Policy

const events: DeskEvent[] = []
const emit = async (e: DeskEvent) => {
  events.push(e)
}

/** Para zdarzeń jednego kroku, dopasowana po `id` — tak jak robi to ekran. */
function step() {
  const start = events.find((e) => e.type === "tool_start" && e.name === KEY)
  const id = (start as { id?: string } | undefined)?.id
  const end = events.find((e) => e.type === "tool_end" && (e as { id?: string }).id === id)
  return { start, end: end as Extract<DeskEvent, { type: "tool_end" }> | undefined }
}

const call = async (tools: Record<string, unknown>) =>
  (tools[KEY] as { execute: (a: unknown) => Promise<unknown> }).execute({ text: "1234567890" })

beforeEach(() => {
  events.length = 0
  fake.wentTo.length = 0
  fake.url = "http://mcp-test:8310/mcp"
  fake.reply = async () => ({ content: [{ type: "text", text: "czynny podatnik" }] })
  // Środowisko JAWNE: bez tego wynik zależałby od tego, co ktoś ma w powłoce.
  for (const key of Object.keys(process.env)) {
    if (/^MCP_/.test(key)) delete process.env[key]
  }
  process.env.MCP_ALLOWED_HOSTS = "mcp-*"
})

describe("adres jest sprawdzany, ZANIM poleci pierwsze żądanie", () => {
  it("serwer spoza allow-listy nie zostaje odpytany ani razu", async () => {
    fake.url = "http://127.0.0.1:5432/mcp"
    const { tools } = await mcpTools(policy, emit)

    // TO JEST TA ASERCJA. Nie „połączenie się nie udało" — połączenia nie było.
    expect(fake.wentTo).toEqual([])
    expect(Object.keys(tools)).toEqual([])
    const blocked = events.find((e) => e.type === "blocked")
    expect(blocked, "odrzucenie adresu nie zostawiło śladu w sprawie").toBeTruthy()
    expect((blocked as { description: string }).description).toContain("127.0.0.1:5432")
  })

  it("`inspectServer` odmawia przed zbudowaniem klienta", async () => {
    // Ta funkcja jest jedynym miejscem wykonującym `tools/list` i strzela pod adres
    // wpisany przed chwilą, jeszcze zanim cokolwiek zostanie zatwierdzone.
    await expect(inspectServer("http://10.20.30.40:8080/mcp", "obcy")).rejects.toBeInstanceOf(
      AddressNotAllowed,
    )
    expect(fake.wentTo).toEqual([])
  })

  it("serwer MCP obok, w tej samej sieci Dockera, dalej działa", async () => {
    // Druga krawędź tej samej reguły: adres kontenera obok jest PRYWATNY z definicji.
    const { tools } = await mcpTools(policy, emit)
    expect(fake.wentTo).toEqual(["http://mcp-test:8310/mcp"])
    expect(Object.keys(tools)).toEqual([KEY])
    expect(events.filter((e) => e.type === "blocked")).toEqual([])
  })
})

describe("para zdarzeń domyka się na każdej ścieżce", () => {
  it("udana odpowiedź wraca do modelu nietknięta i zostawia dowód", async () => {
    const { tools } = await mcpTools(policy, emit)
    const answer = await call(tools)

    const { start, end } = step()
    expect(start).toBeTruthy()
    expect(end!.ok).toBe(true)
    expect(end!.summary).toBe("serwer odpowiedział")
    expect(answer).toEqual({ content: [{ type: "text", text: "czynny podatnik" }] })
  })

  it("cisza serwera kończy krok zamiast wieszać turę", async () => {
    const { tools } = await mcpTools(policy, emit)
    fake.reply = () => new Promise<unknown>(() => {})

    vi.useFakeTimers()
    try {
      const running = call(tools)
      await vi.advanceTimersByTimeAsync(CALL_DEADLINE_MS + 1)
      const answer = await running

      const { end } = step()
      // Bez `tool_end` krok zostałby na ekranie „w toku" NA ZAWSZE i wypadłby z dowodu.
      expect(end, "brak tool_end — krok wisiałby w toku").toBeTruthy()
      expect(end!.ok).toBe(false)
      expect(end!.summary).toContain("30 s")
      // Model dostaje ZDANIE, z którym da się coś zrobić, a nie wyjątek wywracający turę.
      expect(String(answer)).toMatch(/nie odpowiedział/)
      expect(String(answer)).toMatch(/nie zakładaj żadnego wyniku/)
    } finally {
      vi.useRealTimers()
    }
  })

  it("odrzucenie adresu w chwili wywołania też domyka parę", async () => {
    // Bramka siedzi także na ścieżce wywołania, nie tylko przy rejestracji: katalog
    // mógł się zmienić między jednym a drugim, a to wywołanie otwiera gniazdo.
    const { tools } = await mcpTools(policy, emit)
    process.env.MCP_ALLOWED_HOSTS = "mcp-cos-zupelnie-innego"
    const answer = await call(tools)

    const { end } = step()
    expect(end, "brak tool_end przy odrzuconym adresie").toBeTruthy()
    expect(end!.ok).toBe(false)
    expect(end!.summary).toBe("adres serwera nie jest dozwolony")
    expect(String(answer)).toContain("mcp-test:8310")
  })
})

describe("sufit na wynik", () => {
  it("wynik obcięty jest widoczny i dla modelu, i w dowodzie", async () => {
    const { tools } = await mcpTools(policy, emit)
    fake.reply = async () => ({ content: [{ type: "text", text: "x".repeat(RESULT_CEILING * 3) }] })
    const answer = await call(tools)

    const seen = answer as Record<string, unknown>
    expect(seen.incomplete).toBe(true)
    expect(String(seen.note)).toMatch(/NIE jest cała odpowiedź/)

    const { end } = step()
    // Serwer ODPOWIEDZIAŁ, więc krok jest udany — ale dowód mówi, ile z tej odpowiedzi
    // naprawdę weszło. Wynik obcięty nieodróżnialny od pełnego to w tym produkcie
    // klasa błędu, nie drobiazg.
    expect(end!.ok).toBe(true)
    expect(end!.summary).toContain("obcięty")
    expect(end!.summary).toContain(String(RESULT_CEILING))
  })
})
