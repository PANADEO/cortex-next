import { isIP } from "node:net"

/**
 * ADRES SERWERA MCP — allow-lista WDROŻENIOWA, a nie filtr adresów prywatnych.
 *
 * DLACZEGO POWSTAŁ. Adres nie był sprawdzany w ogóle: `client.ts` wkładał `server.url`
 * prosto do transportu, a `inspectServer` strzelał pod podany adres NATYCHMIAST, zanim
 * cokolwiek zostało zatwierdzone. Przełożony, który wpisze `http://127.0.0.1:5432` albo
 * adres w sieci wewnętrznej klienta, każe kontenerowi Biurka tam pójść. To jest SSRF —
 * tyle że spust pociąga człowiek uprawniony, więc w dzienniku nie wygląda na atak.
 *
 * DLACZEGO NIE „TYLKO ADRESY PUBLICZNE". Kuszące i BŁĘDNE. Serwer MCP stojący obok,
 * w tej samej sieci Dockera, adresowany nazwą kontenera, ma adres prywatny z definicji —
 * dokładnie tak jak `postgres` czy `document-parser-backend` w `docker-compose.yml`.
 * Reguła „tylko publiczne" (ta z `egress.go` w piaskownicy, gdzie cel był ODWROTNY:
 * kod z piaskownicy ma wychodzić wyłącznie do internetu) zepsułaby tu poprawne wdrożenie
 * przy pierwszym uruchomieniu. Stąd allow-lista, nie klasyfikacja adresu.
 *
 * SKŁADNIA `MCP_ALLOWED_HOSTS` — pozycje po przecinku, każda `host` albo `host:port`:
 *
 *   mcp-vat-registry          ten host, dowolny port
 *   mcp-vat-registry:8310     ten host, wyłącznie ten port
 *   mcp-*                     gwiazdka zastępuje dowolny ciąg BEZ kropki, czyli jeden
 *                             człon nazwy — nazwę kontenera, nigdy nazwy domenowej
 *   *                         dowolna nazwa jednoczłonowa, czyli „cokolwiek w tej sieci"
 *   *.partner.pl              ta domena i każda jej poddomena, na dowolnej głębokości
 *                             (ten sam idiom, co allow-lista wyjścia w piaskownicy)
 *   [::1]:8310                adres IPv6 w nawiasach, tak jak w URL-u
 *
 * DWIE REGUŁY, KTÓRE NIE WYNIKAJĄ ZE SKŁADNI, i obie są tu celowo:
 *
 * 1. GWIAZDKA NIGDY nie trafia w pętlę zwrotną ani w adres wpisany liczbą. `*` nie oznacza
 *    `localhost`, nie oznacza `127.0.0.1` i nie oznacza `2130706433` (ta sama pętla zwrotna
 *    zapisana jednym numerem — `getaddrinfo` to przyjmuje). Kto chce pętli zwrotnej, pisze
 *    ją wprost RAZEM Z PORTEM: `localhost:8310`. Dzięki temu `localhost:8310` z lokalnego
 *    uruchomienia NIE otwiera `localhost:5432`, czyli bazy — a to jest dokładnie ten
 *    przypadek, od którego cały ten moduł się zaczął.
 * 2. ADRESY, KTÓRE NAZWAŁO SAMO WDROŻENIE, są dozwolone bez wpisywania ich drugi raz.
 *    Każda zmienna `MCP_*_URL` (dziś `MCP_VAT_REGISTRY_URL`) wnosi swój `host:port`.
 *    Uzasadnienie jest w modelu zagrożenia, nie w wygodzie: allow-lista ogranicza to,
 *    co może wprowadzić CZŁOWIEK PRZY EKRANIE. Adres, który stoi w env, jest już decyzją
 *    tej samej osoby, która ustawia allow-listę — sprawdzanie go przeciw niej samej
 *    nie dodaje bezpieczeństwa, a psuje każde działające dziś uruchomienie.
 *
 * WARTOŚĆ DOMYŚLNA `mcp-*`. Serwer MCP postawiony obok Biurka w compose nazywa się
 * `mcp-<coś>` — tak nazywa się jedyny, który w tym repozytorium istnieje
 * (`apps/mcp-vat-registry`). Domyślna wartość przepuszcza więc typowe wdrożenie i NIE
 * przepuszcza: `127.0.0.1` i każdego innego adresu wpisanego liczbą, `postgres`,
 * `cortex-frontend`, `document-parser-backend` ani niczego z sieci wewnętrznej klienta.
 *
 * CZEGO TO NIE PILNUJE, powiedziane wprost, żeby nikt nie brał tego za szczelne:
 *
 * — PRZEKIEROWAŃ. `@ai-sdk/mcp` woła globalny `fetch` bez opcji `redirect` i bez seamu na
 *   własny `fetch` (`MCPTransportConfig` ma tylko `url`, `headers`, `authProvider`), więc
 *   serwer z dozwolonego adresu może odpowiedzieć `302` na `http://127.0.0.1:5432`
 *   i przeglądarkowe `fetch` za nim pójdzie. Sprawdzenie adresu tego NIE łapie, bo widzi
 *   wyłącznie adres pierwszego żądania. Świadomie NIE zamykamy tego dziś: jedyna droga to
 *   własna implementacja `MCPTransport`, czyli przepisanie transportu Streamable HTTP —
 *   nieproporcjonalne do reszty tej zmiany i łatwe do zepsucia po cichu. Dzień, w którym
 *   `MCPTransportConfig` dostanie `fetchFn` (typ `FetchFunction` jest już w tej paczce,
 *   używa go ścieżka OAuth), jest dniem, w którym to się domyka jednym `redirect: "error"`.
 * — ROZWIĄZANIA NAZWY. Nie sprawdzamy, na jaki adres nazwa wskazuje, i to jest decyzja,
 *   nie przeoczenie: tutaj nazwa wskazująca na adres prywatny to WŁAŚNIE przypadek
 *   poprawny (kontener obok). Sprawdzanie po rozwiązaniu nazwy nic by nie wniosło,
 *   a dołożyłoby okno TOCTOU między sprawdzeniem a połączeniem.
 */

/** Nazwa zmiennej idzie do komunikatu dla człowieka, więc stoi w jednym miejscu. */
export const ALLOWED_HOSTS_VARIABLE = "MCP_ALLOWED_HOSTS"

/** Patrz nagłówek: nazwa kontenera serwera MCP stojącego obok Biurka w tym samym compose. */
export const DEFAULT_ALLOWED_HOSTS = "mcp-*"

/** Zmienne, którymi wdrożenie samo nazywa adres serwera MCP. */
const DEPLOYMENT_URL_VARIABLE = /^MCP_[A-Z0-9_]*URL$/

export class AddressNotAllowed extends Error {
  constructor(
    /** `host:port`, tak jak pójdzie do komunikatu — albo surowy napis, gdy nie da się go odczytać */
    readonly host: string,
    /** lista obowiązująca w tej instancji; ekran przełożonego pokazuje ją przy odmowie */
    readonly allowed: string[],
  ) {
    // Zdanie KRÓTKIE i bez listy: ten tekst trafia też do wiersza sprawy, którą czyta
    // pracownik. Pełne zdanie z tym, co dopisać i gdzie, składa ekran przełożonego
    // ze słownika — bo tam stoi osoba, która może coś z tym zrobić.
    super(`Adres ${host} nie jest dozwolony w tej instancji.`)
  }
}

type Address = { host: string; port: number }
type Entry = { host: string; port: number | null }

/** Nazwa pętli zwrotnej — RFC 6761 rezerwuje też całą domenę `.localhost`. */
function loopback(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (isIP(host) === 0) return false
  return (
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host.startsWith("127.") ||
    // IPv4 odwzorowane w IPv6 — ta sama pętla zwrotna, inny zapis.
    host.startsWith("::ffff:127.")
  )
}

/**
 * Nazwa jednoczłonowa — czyli taka, którą rozwiązuje wyłącznie DNS sieci kontenerów.
 * Człon MUSI zaczynać się literą: bez tego `2130706433` przechodziłoby jako „nazwa",
 * a to jest `127.0.0.1` zapisane jednym numerem.
 */
function singleLabel(host: string): boolean {
  return isIP(host) === 0 && /^[a-z][a-z0-9-]*$/.test(host)
}

/** Adres z URL-a: host małymi literami, port jawny albo domyślny dla schematu. */
export function addressOf(url: string): Address | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // Wyłącznie Streamable HTTP. `file:`, `gopher:` i reszta nie są transportem, tylko
  // sposobem na czytanie dysku procesu Node cudzymi rękami.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  // Poświadczenia w adresie to sekret wpisany w pole formularza i zapisany w katalogu
  // w postaci jawnej. Nie ma powodu, żeby to przyjmować.
  if (parsed.username !== "" || parsed.password !== "") return null
  const host = parsed.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "")
  if (host === "") return null
  const port = parsed.port === "" ? (parsed.protocol === "https:" ? 443 : 80) : Number(parsed.port)
  return { host, port }
}

/** `host`, `host:port`, `[ipv6]`, `[ipv6]:port`. Pozycja nieczytelna nie dopasowuje się do niczego. */
function entryOf(raw: string): Entry | null {
  const text = raw.trim().toLowerCase()
  if (text === "") return null
  if (text.startsWith("[")) {
    const close = text.indexOf("]")
    if (close < 0) return null
    const rest = text.slice(close + 1)
    if (rest !== "" && !/^:\d+$/.test(rest)) return null
    return { host: text.slice(1, close), port: rest === "" ? null : Number(rest.slice(1)) }
  }
  const colon = text.lastIndexOf(":")
  if (colon > 0 && /^\d+$/.test(text.slice(colon + 1))) {
    return { host: text.slice(0, colon), port: Number(text.slice(colon + 1)) }
  }
  return { host: text, port: null }
}

function hostMatches(host: string, pattern: string): boolean {
  if (!pattern.includes("*")) return host === pattern
  // Gwiazdka NIGDY nie trafia w pętlę zwrotną ani w adres wpisany liczbą — patrz reguła 1
  // w nagłówku. Kto ich chce, pisze je wprost.
  if (loopback(host) || isIP(host) !== 0) return false
  if (pattern.startsWith("*.")) {
    const domain = pattern.slice(2)
    return host === domain || host.endsWith(`.${domain}`)
  }
  // Poza formą `*.domena` gwiazdka NIE przekracza kropki: `mcp-*` ma trafiać w nazwę
  // kontenera `mcp-vat-registry`, a nie w `mcp-cokolwiek.zewnetrzna-domena.pl`.
  const shape = new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*")}$`,
  )
  if (!shape.test(host)) return false
  return pattern === "*" ? singleLabel(host) : true
}

/** Adresy, które nazwało samo wdrożenie — patrz reguła 2 w nagłówku. */
function namedByDeployment(env: NodeJS.ProcessEnv): string[] {
  const found: string[] = []
  for (const [key, value] of Object.entries(env)) {
    if (!DEPLOYMENT_URL_VARIABLE.test(key) || !value) continue
    const address = addressOf(value)
    if (address) found.push(`${address.host}:${address.port}`)
  }
  return found
}

/** Lista obowiązująca w TEJ instancji, w postaci do pokazania człowiekowi. */
export function allowedAddresses(env: NodeJS.ProcessEnv = process.env): string[] {
  const written = (env[ALLOWED_HOSTS_VARIABLE] ?? "").trim()
  const chosen = written === "" ? DEFAULT_ALLOWED_HOSTS : written
  return [
    ...new Set([
      ...chosen
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x !== ""),
      ...namedByDeployment(env),
    ]),
  ]
}

/**
 * Bramka. Woła się ją ZANIM poleci pierwsze żądanie — czyli i przed `tools/list`
 * na ekranie przyjmowania, i przed zbudowaniem klienta na turę.
 */
export function assertAllowedAddress(url: string, env: NodeJS.ProcessEnv = process.env): void {
  const allowed = allowedAddresses(env)
  const address = addressOf(url)
  if (!address) throw new AddressNotAllowed(url.slice(0, 120), allowed)
  const entries = allowed.map(entryOf).filter((x): x is Entry => x !== null)
  const hit = entries.some(
    (e) => (e.port === null || e.port === address.port) && hostMatches(address.host, e.host),
  )
  if (!hit) throw new AddressNotAllowed(`${address.host}:${address.port}`, allowed)
}
