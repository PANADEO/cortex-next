// Walidacja wejścia rejestru aplikacji. Dwa znaleziska z review:
//  - `z.string().url()` przepuszczał `javascript:`/`data:` (uśpiony stored XSS),
//  - `route` przyjmował `//evil.com` i pełne URL-e (open redirect / phishing).

import { describe, expect, it } from "vitest"
import { applicationInputSchema } from "./system-config"

const NATIVE = {
  code: "raportowanie-tokenow",
  name: "Raportowanie Tokenów",
  kind: "native" as const,
}

const EXTERNAL = {
  code: "czat",
  name: "Czat",
  kind: "external-link" as const,
}

function parseNative(route: string) {
  return applicationInputSchema.safeParse({ ...NATIVE, route })
}

function parseExternal(url: string) {
  return applicationInputSchema.safeParse({ ...EXTERNAL, url })
}

describe("url — tylko http(s)", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "ftp://example.com/plik",
  ])("odrzuca [%s]", (url) => {
    expect(parseExternal(url).success).toBe(false)
  })

  it.each([
    "https://chat.example.com",
    "http://chat.example.com:8080/sciezka?a=1",
    "https://example.com/a/b#kotwica",
  ])("przyjmuje [%s]", (url) => {
    expect(parseExternal(url).success).toBe(true)
  })

  it("komunikat wskazuje pole url", () => {
    const result = parseExternal("javascript:alert(1)")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("url"))).toBe(true)
    }
  })
})

describe("route — tylko ścieżka wewnątrz tej aplikacji", () => {
  it.each([
    "//evil.com",
    "//evil.com/steal",
    "https://evil.com/steal",
    "http://evil.com",
    "/\\evil.com",
    "evil.com",
    "raportowanie",
    "",
    " /raportowanie",
    "/sciezka ze spacja",
  ])("odrzuca [%s]", (route) => {
    expect(parseNative(route).success).toBe(false)
  })

  it.each(["/", "/raportowanie-tokenow", "/a/b/c", "/lista?filtr=nowe", "/sekcja#kotwica"])(
    "przyjmuje [%s]",
    (route) => {
      expect(parseNative(route).success).toBe(true)
    },
  )
})

describe("niezmienniki kształtu", () => {
  it("kafelek natywny nie może mieć url", () => {
    const result = applicationInputSchema.safeParse({
      ...NATIVE,
      route: "/ok",
      url: "https://example.com",
    })
    expect(result.success).toBe(false)
  })

  it("kafelek zewnętrzny nie może mieć route", () => {
    const result = applicationInputSchema.safeParse({
      ...EXTERNAL,
      url: "https://example.com",
      route: "/ok",
    })
    expect(result.success).toBe(false)
  })

  it("kod ograniczony do małych liter, cyfr i myślnika", () => {
    for (const code of ["Wielkie", "ze spacja", "kropka.kropka", "slash/slash", ""]) {
      expect(applicationInputSchema.safeParse({ ...NATIVE, code, route: "/ok" }).success).toBe(false)
    }
  })
})
