import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "node:http"
import { z } from "zod"
import { BledneWywolanie, podmiotPoNip, rachunekPrzypisany } from "./mf.js"

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
 * (`apps/desk/src/core/mcp/katalog.ts`), a `oczyscSchemat` wycina stąd wszystko,
 * co jest napisem. Są tu dla ludzi czytających ten serwer i dla innych klientów.
 */

const PORT = Number(process.env.MCP_BIALA_LISTA_PORT ?? 8310)

function serwer() {
  const s = new McpServer(
    { name: "biala-lista", version: "0.1.0" },
    { capabilities: { tools: {} } },
  )

  s.registerTool(
    "sprawdz_nip",
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
        const p = await podmiotPoNip(nip, data)
        if (!p) return tekst(`W wykazie nie ma podatnika o NIP ${nip} na ten dzień.`)
        return tekst(
          [
            `${p.nazwa} (NIP ${p.nip})`,
            `Status VAT: ${p.statusVat}`,
            p.adres ? `Adres: ${p.adres}` : null,
            p.dataRejestracji ? `Zarejestrowany od: ${p.dataRejestracji}` : null,
            `Rachunków w wykazie: ${p.rachunki.length}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      } catch (e) {
        return blad(e)
      }
    },
  )

  s.registerTool(
    "sprawdz_rachunek",
    {
      title: "Sprawdź rachunek kontrahenta",
      description:
        "Odpowiada, czy podany rachunek był w wykazie przypisany do podanego NIP w danym dniu. " +
        "Zwraca identyfikator zapytania — to on jest dowodem sprawdzenia.",
      inputSchema: {
        nip: z.string().describe("NIP kontrahenta"),
        rachunek: z.string().describe("numer rachunku, 26 cyfr"),
        data: z.string().optional().describe("dzień w formacie RRRR-MM-DD; domyślnie dziś"),
      },
    },
    async ({ nip, rachunek, data }) => {
      try {
        const w = await rachunekPrzypisany(nip, rachunek, data)
        return tekst(
          [
            w.przypisany
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
        return blad(e)
      }
    },
  )

  return s
}

const tekst = (t: string) => ({ content: [{ type: "text" as const, text: t }] })

/**
 * Błąd wraca jako treść z `isError`, nie jako wyjątek transportu. Rozróżnienie jest
 * istotne po stronie Biurka: „wykaz odpowiedział, że NIP jest zły" to inna rzecz niż
 * „nie udało się połączyć", a tylko to drugie ma zapalać kłódkę.
 */
function blad(e: unknown) {
  const m = e instanceof BledneWywolanie ? e.message : "Nie udało się odpytać wykazu."
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
    res.end(JSON.stringify({ ok: true, serwer: "biala-lista" }))
    return
  }
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404)
    res.end()
    return
  }

  const kawalki: Buffer[] = []
  for await (const k of req) kawalki.push(k as Buffer)
  const cialo = kawalki.length ? JSON.parse(Buffer.concat(kawalki).toString("utf8")) : undefined

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
  const s = serwer()
  // Ta sama niezgodność co wyżej, po drugiej stronie tego samego obiektu.
  // @ts-expect-error — typy @modelcontextprotocol/sdk nie znoszą exactOptionalPropertyTypes
  await s.connect(transport)
  await transport.handleRequest(req, res, cialo)
})

http.listen(PORT, () => {
  // Zakaz `console` w tym repo pilnuje kodu, który leci do PRZEGLĄDARKI. To jest
  // proces serwerowy uruchamiany z terminala i jedna linia po starcie jest jedynym
  // sposobem, żeby człowiek wiedział, że proces stoi i na którym porcie.
  // eslint-disable-next-line no-console
  console.log(`[biala-lista] serwer MCP słucha na http://localhost:${PORT}/mcp`)
})
