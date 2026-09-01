import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "node:http"
import { z } from "zod"
import { accountAssigned, BadToolCall, entityByNip } from "./mf.js"

/**
 * SERWER MCP — wykaz podatników VAT Ministerstwa Finansów („biała lista").
 *
 * Stoi w OSOBNYM PROCESIE i to jest cały sens tego kroku: brama zdolności Biurka
 * ma pokazać, że działa na czymś, czego nie napisaliśmy w tym samym pliku co agenta.
 *
 * Wyłącznie odczyt. Ten serwer nie ma ani jednego narzędzia, które cokolwiek zmienia —
 * pierwszy konektor u klienta nie jest miejscem na czynności nieodwracalne.
 *
 * Uwaga o opisach: teksty poniżej trafiają do klienta MCP, ale Biurko ICH NIE UŻYWA.
 * Opis widziany przez model pisze po polsku osoba zatwierdzająca narzędzie
 * (`packages/@cortex/desk-core/src/mcp/catalogue.ts`), a `oczyscSchemat` wycina stąd wszystko,
 * co jest napisem. Są tu dla ludzi czytających ten serwer i dla innych klientów.
 */

const PORT = Number(process.env.MCP_VAT_REGISTRY_PORT ?? 8310)

function server() {
  const s = new McpServer(
    { name: "vat-registry", version: "0.1.0" },
    { capabilities: { tools: {} } },
  )

  s.registerTool(
    "vat_status",
    {
      title: "Sprawdź podatnika po NIP",
      description: "Zwraca nazwę, status VAT i rachunki podatnika z wykazu Ministerstwa Finansów.",
      inputSchema: {
        nip: z.string().describe("NIP, dziesięć cyfr; myślniki i spacje są dopuszczalne"),
        data: z.string().optional().describe("dzień w formacie RRRR-MM-DD; domyślnie dziś"),
      },
    },
    async ({ nip, data }) => {
      try {
        const p = await entityByNip(nip, data)
        if (!p) return text(`W wykazie nie ma podatnika o NIP ${nip} na ten dzień.`)
        return text(
          [
            `${p.name} (NIP ${p.nip})`,
            `Status VAT: ${p.statusVat}`,
            p.address ? `Adres: ${p.address}` : null,
            p.dataRejestracji ? `Zarejestrowany od: ${p.dataRejestracji}` : null,
            `Rachunków w wykazie: ${p.accounts.length}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      } catch (e) {
        return error(e)
      }
    },
  )

  s.registerTool(
    "bank_account_check",
    {
      title: "Sprawdź rachunek kontrahenta",
      description:
        "Odpowiada, czy podany rachunek był w wykazie przypisany do podanego NIP w danym dniu. " +
        "Zwraca identyfikator zapytania — to on jest dowodem sprawdzenia.",
      inputSchema: {
        nip: z.string().describe("NIP kontrahenta"),
        account: z.string().describe("numer rachunku, 26 cyfr"),
        data: z.string().optional().describe("dzień w formacie RRRR-MM-DD; domyślnie dziś"),
      },
    },
    async ({ nip, account, data }) => {
      try {
        const w = await accountAssigned(nip, account, data)
        return text(
          [
            w.assigned
              ? `TAK — rachunek był przypisany do NIP ${nip} w dniu ${w.data}.`
              : `NIE — rachunek NIE był przypisany do NIP ${nip} w dniu ${w.data}.`,
            w.identyfikatorZapytania
              ? `Identyfikator zapytania: ${w.identyfikatorZapytania}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      } catch (e) {
        return error(e)
      }
    },
  )

  return s
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] })

/**
 * Błąd wraca jako treść z `isError`, nie jako wyjątek transportu. Rozróżnienie jest
 * istotne po stronie Biurka: „wykaz odpowiedział, że NIP jest zły" to inna rzecz niż
 * „nie udało się połączyć", a tylko to drugie ma zapalać kłódkę.
 */
function error(e: unknown) {
  const m = e instanceof BadToolCall ? e.message : "Nie udało się odpytać wykazu."
  return { content: [{ type: "text" as const, text: m }], isError: true }
}

/**
 * Tryb bezsesyjny: nowy serwer i nowy transport na każde żądanie.
 * Dla serwera wyłącznie do odczytu, bez stanu między wywołaniami, sesja byłaby
 * kosztem bez pokrycia — a przy tym jednym miejscem mniej, w którym coś może wyciec
 * między dwoma użytkownikami.
 */
const http = createServer(async (req, res) => {
  if (req.url === "/zdrowie") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true, server: "vat-registry" }))
    return
  }
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404)
    res.end()
    return
  }

  const chunks: Buffer[] = []
  for await (const k of req) chunks.push(k as Buffer)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined

  // `sessionIdGenerator: undefined` to UDOKUMENTOWANY sposób wyłączenia sesji w SDK MCP:
  // pole opcjonalne, którego wartością ma być `undefined`. Pod `exactOptionalPropertyTypes`
  // (włączonym w konfiguracji korzenia) to co innego niż pominięcie klucza — a pominięcie
  // włączyłoby sesje, czyli zmieniłoby zachowanie serwera. Typy SDK tej flagi nie
  // przewidują; `@ts-expect-error`, a nie rzutowanie, bo zgaśnie samo, gdy je poprawią.
  // @ts-expect-error — typy @modelcontextprotocol/sdk nie znoszą exactOptionalPropertyTypes
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on("close", () => {
    transport.close()
    s.close()
  })
  const s = server()
  // Ta sama niezgodność co wyżej, po drugiej stronie tego samego obiektu.
  // @ts-expect-error — typy @modelcontextprotocol/sdk nie znoszą exactOptionalPropertyTypes
  await s.connect(transport)
  await transport.handleRequest(req, res, body)
})

http.listen(PORT, () => {
  // Zakaz `console` w tym repo pilnuje kodu, który leci do PRZEGLĄDARKI. To jest
  // proces serwerowy uruchamiany z terminala i jedna linia po starcie jest jedynym
  // sposobem, żeby człowiek wiedział, że proces stoi i na którym porcie.
  // eslint-disable-next-line no-console
  console.log(`[vat-registry] serwer MCP słucha na http://localhost:${PORT}/mcp`)
})
