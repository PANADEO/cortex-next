// Walidacja manifestu kafelka. Pakiet nie miał dotąd żadnego testu — dostaje go
// razem z polami prezentacyjnymi (K1, PROJECT/cortex-frontend/ARTIFACTS/
// licencjonowanie/cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md D2),
// bo ich tryb awarii jest CICHY: `defineTile()` zwraca `TileManifestSchema.parse()`,
// a Zod ucina klucze spoza schematu. Pole dopisane do manifestu, ale nie do
// schematu, znika bez błędu — build przechodzi, tile-manifests.generated.json
// jest bez niego, kolumna w bazie zostaje pusta. Dlatego testy sprawdzają nie
// tylko "parsuje się", ale i to, że wartość FAKTYCZNIE JEST w wyniku.

import { describe, expect, it } from "vitest"
import { defineTile, TileManifestSchema, type TileManifest } from "./index"

const NATIVE = {
  id: "raportowanie-tokenow",
  kind: "native",
  label: "Raportowanie Tokenów",
  entitlementCode: "token-usage",
  route: "/token-usage",
} satisfies TileManifest

const EXTERNAL = {
  id: "czat",
  kind: "external-link",
  label: "Czat",
  entitlementCode: "czat",
  url: "https://chat.example.com",
} satisfies TileManifest

const PRESENTATION = {
  description: "Zużycie tokenów w rozbiciu na moduły",
  icon: "BarChart3",
  color: "sky",
  categoryFunctional: "admin-system",
  categoryDepartment: ["it", "finance"],
  sortOrder: 160,
} satisfies Partial<TileManifest>

describe("pola prezentacyjne — komplet przechodzi przez parse i NIE jest ucinany", () => {
  it("wszystkie sześć wraca z defineTile() z wartościami bez zmian", () => {
    // Sedno testu: `toMatchObject` na WYNIKU, nie `success: true` na wejściu.
    // Sam fakt, że schemat coś przyjął, nic tu nie dowodzi — Zod przyjmuje
    // także obiekt z nadmiarowymi kluczami, po cichu je wyrzucając.
    expect(defineTile({ ...NATIVE, ...PRESENTATION })).toMatchObject(PRESENTATION)
  })

  it("klucz spoza schematu ZNIKA — to jest ta pułapka, przed którą bronią testy wyżej", () => {
    // ODWRÓCENIE DECYZJI K1, zapisane wprost. K1 twierdził tu, że `show_on_hub`
    // jest kolumną "świadomie NIEobecną w manifeście", czyli że manifest nie ma
    // o niej nic do powiedzenia. To przestało być prawdą w K1b: manifest
    // ROZSTRZYGA jej wartość początkową — przez `entitlementOnly` (testy niżej),
    // bo cztery kody w rejestrze nie są kafelkami, tylko uprawnieniami, a po K3
    // nic innego nie trzymałoby ich poza hubem.
    //
    // Sam klucz `showOnHub` w manifeście dalej jednak NIE ISTNIEJE i ta asercja
    // zostaje — celowo, w nowej roli. K1b wybrał nazwę semantyczną ("czym ten
    // kod jest"), a nie nazwę kolumny ("jak się renderuje"), więc `showOnHub`
    // wpisane do manifestu wygląda teraz na pole, które MUSI działać, skoro
    // manifest tę kolumnę ustawia.
    //
    // Zasięg pułapki jest jednak węższy, niż mówił komentarz K1 — zmierzone,
    // nie założone. W realnym manifeście (`defineTile({ ... })`, literał
    // obiektu) nadmiarowy klucz łapie TYPECHECK: TS2353 "Object literal may
    // only specify known properties". Dotyczy to także literału ZAWIERAJĄCEGO
    // spread — `defineTile({ ...base, showOnHub: false })` też nie kompiluje.
    // Czyli `pnpm typecheck` pada i nikt tego nie wdroży.
    //
    // Zod ucina po cichu wyłącznie tam, gdzie kontrola literału nie ma czego
    // sprawdzać: przy rzutowaniu (jak `as unknown as TileManifest` niżej) i
    // gdy obiekt powstaje NAJPIERW w zmiennej, a dopiero potem trafia do
    // defineTile(). Obie formy zweryfikowane na tym repo. Test pilnuje więc
    // tej cichej połowy; głośną trzyma kompilator.
    const withUnknownField = { ...NATIVE, showOnHub: false } as unknown as TileManifest
    expect(defineTile(withUnknownField)).not.toHaveProperty("showOnHub")
    // Kontrola pozytywna do powyższego: pole, które NAPRAWDĘ wyraża tę samą
    // intencję, przechodzi przez parse i zostaje w wyniku.
    expect(defineTile({ ...NATIVE, entitlementOnly: true })).toHaveProperty("entitlementOnly", true)
  })

  it("manifest bez nich nadal jest poprawny (opcjonalne, kolumny są nullable)", () => {
    expect(TileManifestSchema.safeParse(NATIVE).success).toBe(true)
  })

  it("kafelek nienatywny też może je mieć — hub renderuje kartę niezależnie od kind", () => {
    expect(defineTile({ ...EXTERNAL, ...PRESENTATION })).toMatchObject(PRESENTATION)
  })
})

// K1b. Siódme pole, ale NIE prezentacyjne: mówi, czym wiersz JEST (uprawnienie,
// nie kafelek), a nie jak wygląda. Tryb awarii jest asymetryczny i dlatego
// domyślna odpowiedź musi brzmieć "to jest kafelek": pole zapomniane przy
// uprawnieniu daje jedną nadmiarową kartę na hubie (widoczne, admin schowa),
// pole domyślnie ukrywające dałoby zniknięcie prawdziwego kafelka (ciche).
describe("entitlementOnly — wiersz-uprawnienie zamiast kafelka", () => {
  it("przechodzi przez parse i NIE jest ucinany", () => {
    expect(defineTile({ ...NATIVE, entitlementOnly: true })).toMatchObject({ entitlementOnly: true })
  })

  it("pominięcie pola znaczy 'to jest kafelek' — klucza nie ma w wyniku, nie ma też false", () => {
    // Ma znaczenie dla seeda: `manifest.entitlementOnly !== true` musi dać
    // `show_on_hub = true` dla WSZYSTKICH 23 manifestów bez tego pola.
    expect(defineTile(NATIVE)).not.toHaveProperty("entitlementOnly")
  })

  it("odrzuca `false` — to byłby drugi sposób zapisania tego samego co pominięcie", () => {
    // Ta sama zasada, co przy pustej tablicy w categoryDepartment i pustym
    // stringu w description (K1): jedna intencja, jeden zapis.
    expect(TileManifestSchema.safeParse({ ...NATIVE, entitlementOnly: false }).success).toBe(false)
  })

  it.each([["truthy string", "true"], ["jedynka", 1], ["null", null]])(
    "odrzuca %s — kolumna jest booleanem, a cicha koercja ukryłaby kafelek",
    (_opis, entitlementOnly) => {
      expect(TileManifestSchema.safeParse({ ...NATIVE, entitlementOnly }).success).toBe(false)
    },
  )
})

describe("color — wyłącznie token z palety", () => {
  it.each(["purple", "Sky", "bg-sky-200", "sky-500", ""])("odrzuca [%s]", (color) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, color }).success).toBe(false)
  })

  it("komunikat wskazuje pole color", () => {
    const result = TileManifestSchema.safeParse({ ...NATIVE, color: "purple" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("color"))).toBe(true)
    }
  })
})

describe("kategorie — wyłącznie wartości z zamkniętych list huba", () => {
  // "analytics"/"sales" to nie są wymyślone łańcuchy: dokładnie takich wartości
  // spoza listy używa dziś ręczna edycja SQL-em, a hub wyrzuca wtedy kafelek ze
  // WSZYSTKICH zakładek kategorii, nie sygnalizując niczego.
  it.each(["analytics", "Misc", "admin_system", ""])("categoryFunctional odrzuca [%s]", (value) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, categoryFunctional: value }).success).toBe(false)
  })

  it.each([
    ["dział spoza listy", ["sales"]],
    ["jeden zły wśród poprawnych", ["operations", "sales"]],
    ["zła wielkość liter", ["Operations"]],
  ])("categoryDepartment odrzuca: %s", (_opis, categoryDepartment) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, categoryDepartment }).success).toBe(false)
  })

  it("categoryDepartment odrzuca pustą tablicę — od 'brak działu' jest pominięcie pola", () => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, categoryDepartment: [] }).success).toBe(false)
  })

  it("categoryDepartment odrzuca goły string zamiast tablicy", () => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, categoryDepartment: "operations" }).success).toBe(
      false,
    )
  })
})

describe("icon — nazwa z lucide-react, nie ścieżka i nie kebab-case", () => {
  it.each(["scan-text", "scanText", "lucide:ScanText", "/ikony/scan.svg", "", "A".repeat(65)])(
    "odrzuca [%s]",
    (icon) => {
      expect(TileManifestSchema.safeParse({ ...NATIVE, icon }).success).toBe(false)
    },
  )

  it.each(["ScanText", "BarChart3", "Users"])("przyjmuje [%s]", (icon) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, icon }).success).toBe(true)
  })
})

describe("description", () => {
  it("odrzuca pusty string — 'brak opisu' wyraża się pominięciem pola", () => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, description: "" }).success).toBe(false)
  })

  it("odrzuca dłuższy niż 500 znaków (limit kolumny po stronie @cortex/service)", () => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, description: "a".repeat(501) }).success).toBe(false)
    expect(TileManifestSchema.safeParse({ ...NATIVE, description: "a".repeat(500) }).success).toBe(true)
  })
})

describe("sortOrder — pozycja startowa, te same granice co w @cortex/service", () => {
  it.each([-1, 1.5, 10_001, Number.NaN, Number.POSITIVE_INFINITY])("odrzuca [%s]", (sortOrder) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, sortOrder }).success).toBe(false)
  })

  it("odrzuca liczbę podaną jako string — kolumna jest integerem, nie tekstem", () => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, sortOrder: "10" }).success).toBe(false)
  })

  it.each([0, 10, 10_000])("przyjmuje [%s]", (sortOrder) => {
    expect(TileManifestSchema.safeParse({ ...NATIVE, sortOrder }).success).toBe(true)
  })

  it("zero jest wartością jawną, nie brakiem — pominięcie pola to co innego", () => {
    expect(defineTile({ ...NATIVE, sortOrder: 0 })).toHaveProperty("sortOrder", 0)
    expect(defineTile(NATIVE)).not.toHaveProperty("sortOrder")
  })
})

// Siatka regresyjna: K1 dokłada pola, więc musi udowodnić, że NIE poluzował
// niczego, co schemat odrzucał wcześniej (open redirect, stored XSS, kod
// uprawnienia niepasujący do kolumny w bazie, rozjazd kind <-> route/url).
describe("defineTile nadal odrzuca wszystko, co odrzucał przed K1", () => {
  it.each([
    ["native bez route", { ...NATIVE, route: undefined }],
    ["native z url", { ...NATIVE, url: "https://example.com" }],
    ["external bez url", { ...EXTERNAL, url: undefined }],
    ["external z route", { ...EXTERNAL, route: "/czat" }],
    ["route protocol-relative", { ...NATIVE, route: "//evil.com" }],
    ["route z backslashem", { ...NATIVE, route: "/\\evil.com" }],
    ["route jako pełny URL", { ...NATIVE, route: "https://evil.com/steal" }],
    ["route bez wiodącego ukośnika", { ...NATIVE, route: "token-usage" }],
    ["entitlementCode z wielką literą", { ...NATIVE, entitlementCode: "Token-Usage" }],
    ["entitlementCode z podkreśleniem", { ...NATIVE, entitlementCode: "token_usage" }],
    ["entitlementCode pusty", { ...NATIVE, entitlementCode: "" }],
    ["entitlementCode dłuższy niż 64 znaki", { ...NATIVE, entitlementCode: "a".repeat(65) }],
    ["kind spoza listy", { ...NATIVE, kind: "widget" }],
    ["label pusty", { ...NATIVE, label: "" }],
    ["id puste", { ...NATIVE, id: "" }],
  ])("%s", (_opis, manifest) => {
    expect(() => defineTile(manifest as unknown as TileManifest)).toThrow()
  })

  it.each([
    ["native", NATIVE],
    ["external-link", EXTERNAL],
  ])("nadal przyjmuje poprawny manifest %s", (_opis, manifest) => {
    expect(defineTile(manifest)).toMatchObject(manifest)
  })
})
