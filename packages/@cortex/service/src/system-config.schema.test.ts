// Walidacja wejścia rejestru aplikacji. Dwa znaleziska z review:
//  - `z.string().url()` przepuszczał `javascript:`/`data:` (uśpiony stored XSS),
//  - `route` przyjmował `//evil.com` i pełne URL-e (open redirect / phishing).

import { describe, expect, it } from "vitest"
import {
  applicationInputSchema,
  applicationPatchSchema,
  nextSortOrder,
  roleInputSchema,
  rolePatchSchema,
  userInputSchema,
  userPatchSchema,
} from "./system-config"

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

describe("userInputSchema — pre-provisioning użytkownika", () => {
  it("przyjmuje sam e-mail, fullName opcjonalne", () => {
    expect(userInputSchema.safeParse({ email: "jan@firma.pl" }).success).toBe(true)
    expect(userInputSchema.safeParse({ email: "jan@firma.pl", fullName: "Jan Kowalski" }).success).toBe(
      true,
    )
    expect(userInputSchema.safeParse({ email: "jan@firma.pl", fullName: null }).success).toBe(true)
  })

  it.each(["nie-email", "jan@", "@firma.pl", "", "jan firma.pl"])(
    "odrzuca nieprawidłowy e-mail [%s]",
    (email) => {
      expect(userInputSchema.safeParse({ email }).success).toBe(false)
    },
  )

  it("nie przyjmuje isActive ani id z formularza — to nie są pola tego schematu", () => {
    const parsed = userInputSchema.safeParse({ email: "jan@firma.pl", isActive: false, id: "x" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("isActive")
      expect(parsed.data).not.toHaveProperty("id")
    }
  })
})

describe("userPatchSchema — edycja użytkownika", () => {
  it("wszystkie pola opcjonalne — pusty obiekt jest poprawny (PATCH bez zmian)", () => {
    expect(userPatchSchema.safeParse({}).success).toBe(true)
  })

  it("przyjmuje samo isActive albo samo fullName", () => {
    expect(userPatchSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(userPatchSchema.safeParse({ fullName: "Jan" }).success).toBe(true)
    expect(userPatchSchema.safeParse({ fullName: null }).success).toBe(true)
  })

  it("odrzuca isActive spoza typu boolean", () => {
    expect(userPatchSchema.safeParse({ isActive: "false" }).success).toBe(false)
  })
})

describe("roleInputSchema — tworzenie roli", () => {
  it("przyjmuje kod/nazwę, opis opcjonalny", () => {
    expect(roleInputSchema.safeParse({ code: "marketing", name: "Marketing" }).success).toBe(true)
    expect(
      roleInputSchema.safeParse({ code: "marketing", name: "Marketing", description: "Opis" }).success,
    ).toBe(true)
  })

  it("kod ograniczony do małych liter, cyfr i myślnika — identycznie jak aplikacje", () => {
    for (const code of ["Wielkie", "ze spacja", "kropka.kropka", "slash/slash", ""]) {
      expect(roleInputSchema.safeParse({ code, name: "X" }).success).toBe(false)
    }
  })

  it("isSystem nie jest polem tego schematu — nigdy nie da się go ustawić z formularza", () => {
    const parsed = roleInputSchema.safeParse({ code: "marketing", name: "Marketing", isSystem: true })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).not.toHaveProperty("isSystem")
  })
})

// K4/D5. Zachowanie na PRAWDZIWEJ bazie (nowa aplikacja ląduje za wszystkim,
// co już istnieje) dowodzi system-config.integration.test.ts. Tutaj zostają
// dwa przypadki, których na tamtej bazie pokazać się NIE DA, bo jest
// współdzielona z seedem i równoległymi suitami: PUSTA tabela (nie da się jej
// opróżnić) i wiersz przy samej górnej granicy (nie da się go tam wstawić bez
// psucia kolejności innym testom).
describe("nextSortOrder — nowy wiersz ląduje na końcu listy", () => {
  it("pusta tabela (max(sort_order) = NULL, nie 0) daje 0 — pierwszy wiersz nie ma za czym lądować", () => {
    expect(nextSortOrder(null)).toBe(0)
  })

  it("dokłada krok 10 do najwyższej istniejącej pozycji", () => {
    expect(nextSortOrder(0)).toBe(10)
    expect(nextSortOrder(220)).toBe(230)
  })

  it("przycina do górnej granicy kontraktu zapisu — inaczej edycja takiego wiersza wracałaby 400", () => {
    expect(nextSortOrder(10_000)).toBe(10_000)
    // Sedno przycinania: cokolwiek stąd wyjdzie, musi przejść przez PATCH-a.
    // Wartość 10_010 wstawiłaby się (kolumna to zwykły integer), ale odbiłaby
    // się od walidacji SCALONEGO wiersza w updateApplication przy każdym
    // PATCH-u, który sam nie niesie `sortOrder` — czyli przy zwykłej edycji
    // nazwy/opisu/ikony. PATCH z własnym `sortOrder` (tryb "Zmień kolejność")
    // przechodzi, bo mergeApplicationInput woli wartość z patcha.
    expect(applicationPatchSchema.safeParse({ sortOrder: nextSortOrder(10_000) }).success).toBe(true)
    expect(applicationPatchSchema.safeParse({ sortOrder: 10_010 }).success).toBe(false)
  })

  // Saturacja przy suficie jest ŚWIADOMA, nie przeoczeniem — ten test istnieje
  // po to, żeby ktoś, kto ją odkryje, zobaczył ją zapisaną jako decyzja.
  it("przy suficie saturuje — kolejne utworzenia remisują, tak jak dwa równoległe POST-y", () => {
    expect(nextSortOrder(9_995)).toBe(10_000)
    expect(nextSortOrder(10_000)).toBe(10_000)
  })
})

describe("rolePatchSchema — edycja roli", () => {
  it("wszystkie pola opcjonalne — pusty obiekt jest poprawny", () => {
    expect(rolePatchSchema.safeParse({}).success).toBe(true)
  })

  it("code i isSystem nie są polami tego schematu — niezmienne z poziomu API", () => {
    const parsed = rolePatchSchema.safeParse({ name: "X", code: "cos-innego", isSystem: true })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("code")
      expect(parsed.data).not.toHaveProperty("isSystem")
    }
  })
})
