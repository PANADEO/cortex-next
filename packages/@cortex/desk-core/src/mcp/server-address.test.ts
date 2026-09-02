// Allow-lista wdrożeniowa adresów serwerów MCP.
//
// DLACZEGO POWSTAŁ. Adres serwera nie był sprawdzany w ogóle — `client.ts` wkładał go
// prosto do transportu, a `inspectServer` strzelał pod niego natychmiast, jeszcze zanim
// cokolwiek zostało zatwierdzone. Przełożony wpisujący `http://127.0.0.1:5432` albo adres
// z sieci wewnętrznej klienta kazał kontenerowi Biurka tam pójść, i w dzienniku wyglądało
// to jak zwykła czynność uprawnionej osoby.
//
// TEN PLIK PILNUJE OBU KRAWĘDZI NARAZ, bo łatwo naprawić jedną kosztem drugiej:
//  — adres spoza listy ma być ODRZUCONY,
//  — a serwer MCP stojący obok w tej samej sieci Dockera, czyli pod adresem PRYWATNYM
//    z definicji, ma dalej DZIAŁAĆ. Reguła „tylko adresy publiczne" zepsułaby poprawne
//    wdrożenie i przeszłaby połowę asercji tego pliku.

import { describe, expect, it } from "vitest"
import {
  AddressNotAllowed,
  addressOf,
  ALLOWED_HOSTS_VARIABLE,
  allowedAddresses,
  assertAllowedAddress,
  DEFAULT_ALLOWED_HOSTS,
} from "./server-address"

/** Środowisko testu jest JAWNE — inaczej wynik zależałby od tego, kto co ma w powłoce. */
const withList = (list?: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv =>
  ({
    ...(list === undefined ? {} : { [ALLOWED_HOSTS_VARIABLE]: list }),
    ...extra,
  }) as NodeJS.ProcessEnv

const allows = (url: string, env: NodeJS.ProcessEnv) => {
  try {
    assertAllowedAddress(url, env)
    return true
  } catch {
    return false
  }
}

describe("wartość domyślna nie blokuje typowego wdrożenia compose", () => {
  it("serwer MCP obok, adresowany nazwą kontenera, przechodzi bez żadnej konfiguracji", () => {
    // TO JEST TA ASERCJA. Adres jest prywatny z definicji — i ma działać.
    expect(allows("http://mcp-vat-registry:8310/mcp", withList())).toBe(true)
  })

  it("wartość domyślna jest jawna i widoczna, a nie ukryta w warunku", () => {
    expect(DEFAULT_ALLOWED_HOSTS).toBe("mcp-*")
    expect(allowedAddresses(withList())).toEqual(["mcp-*"])
  })

  it("adres, który nazwało samo wdrożenie, wchodzi razem ze swoim portem", () => {
    // Lokalne uruchomienie: serwer stoi na porcie 8310 hosta i tak jest podany w env.
    const env = withList(undefined, { MCP_VAT_REGISTRY_URL: "http://localhost:8310/mcp" })
    expect(allowedAddresses(env)).toContain("localhost:8310")
    expect(allows("http://localhost:8310/mcp", env)).toBe(true)
    // …ale wyłącznie ten port. Ten sam host na porcie bazy jest dalej odrzucony —
    // to jest dokładnie ten przypadek, od którego cała ta bramka się zaczęła.
    expect(allows("http://localhost:5432/", env)).toBe(false)
  })
})

describe("adresy, których przełożony nie ma prawa wskazać", () => {
  const env = withList()

  it.each([
    ["pętla zwrotna z portem bazy", "http://127.0.0.1:5432/"],
    ["pętla zwrotna po nazwie", "http://localhost:5432/"],
    ["pętla zwrotna zapisana jednym numerem", "http://2130706433/"],
    ["pętla zwrotna w IPv6", "http://[::1]:8310/mcp"],
    ["sieć wewnętrzna klienta po adresie", "http://10.20.30.40:8080/mcp"],
    ["sieć wewnętrzna klienta po nazwie", "https://sap.klient.local/mcp"],
    ["metadane chmury", "http://169.254.169.254/latest/meta-data/"],
    ["baza tego samego compose", "http://postgres:5432/"],
    ["sam frontend tego samego compose", "http://cortex-frontend/api/mcp"],
    ["schemat spoza HTTP", "file:///etc/passwd"],
    ["poświadczenia wpisane w adres", "http://user:secret@mcp-vat-registry:8310/mcp"],
    ["adres nie do odczytania", "to nie jest adres"],
  ])("%s jest odrzucony", (_what, url) => {
    expect(allows(url, env)).toBe(false)
  })

  it("odmowa niesie host i obowiązującą listę, a nie sam napis", () => {
    // Ekran przełożonego składa z tego zdanie ze słownika — „co dopisać i gdzie".
    // Bez tych pól zostałby stack trace, czyli komunikat dla nikogo.
    try {
      assertAllowedAddress("http://127.0.0.1:5432/", withList("mcp-*"))
      expect.unreachable("adres spoza listy przeszedł")
    } catch (e) {
      expect(e).toBeInstanceOf(AddressNotAllowed)
      expect((e as AddressNotAllowed).host).toBe("127.0.0.1:5432")
      expect((e as AddressNotAllowed).allowed).toEqual(["mcp-*"])
      expect(ALLOWED_HOSTS_VARIABLE).toBe("MCP_ALLOWED_HOSTS")
    }
  })
})

describe("składnia listy", () => {
  it("host bez portu otwiera każdy port, host z portem tylko swój", () => {
    expect(allows("http://mcp-crm:9000/mcp", withList("mcp-crm"))).toBe(true)
    expect(allows("http://mcp-crm:9000/mcp", withList("mcp-crm:8310"))).toBe(false)
    expect(allows("http://mcp-crm:8310/mcp", withList("mcp-crm:8310"))).toBe(true)
  })

  it("gwiazdka nie przekracza kropki, więc nie da się jej podstawić domeną", () => {
    expect(allows("http://mcp-crm:8310/mcp", withList("mcp-*"))).toBe(true)
    // `mcp-cokolwiek.zewnetrzna.pl` NIE jest kontenerem obok, choć zaczyna się tak samo.
    expect(allows("https://mcp-crm.zewnetrzna.pl/mcp", withList("mcp-*"))).toBe(false)
  })

  it("forma *.domena obejmuje domenę i poddomeny na dowolnej głębokości", () => {
    const env = withList("*.partner.pl")
    expect(allows("https://partner.pl/mcp", env)).toBe(true)
    expect(allows("https://mcp.partner.pl/mcp", env)).toBe(true)
    expect(allows("https://a.b.partner.pl/mcp", env)).toBe(true)
    expect(allows("https://partner.pl.podszywacz.pl/mcp", env)).toBe(false)
  })

  it("sama gwiazdka znaczy „cokolwiek w tej sieci”, a nie „cokolwiek”", () => {
    const env = withList("*")
    expect(allows("http://mcp-crm:8310/mcp", env)).toBe(true)
    expect(allows("http://postgres:5432/", env)).toBe(true)
    // …ale gwiazdka NIGDY nie obejmuje pętli zwrotnej ani adresu wpisanego liczbą.
    // Kto ich chce, wpisuje je wprost razem z portem.
    expect(allows("http://127.0.0.1:5432/", env)).toBe(false)
    expect(allows("http://localhost:5432/", env)).toBe(false)
    expect(allows("https://cokolwiek.zewnetrzna.pl/", env)).toBe(false)
  })

  it("pętla zwrotna wpisana wprost razem z portem jest dozwolona", () => {
    expect(allows("http://localhost:8310/mcp", withList("localhost:8310"))).toBe(true)
    expect(allows("http://127.0.0.1:8310/mcp", withList("127.0.0.1:8310"))).toBe(true)
    expect(allows("http://[::1]:8310/mcp", withList("[::1]:8310"))).toBe(true)
  })

  it("port domyślny schematu liczy się tak samo jak wpisany", () => {
    expect(addressOf("https://mcp.partner.pl/mcp")).toEqual({ host: "mcp.partner.pl", port: 443 })
    expect(addressOf("http://mcp.partner.pl/mcp")).toEqual({ host: "mcp.partner.pl", port: 80 })
    expect(allows("https://mcp.partner.pl/mcp", withList("mcp.partner.pl:443"))).toBe(true)
    expect(allows("https://mcp.partner.pl/mcp", withList("mcp.partner.pl:8310"))).toBe(false)
  })
})
