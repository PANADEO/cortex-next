// Kontrakt "serwer oddaje KOD, klient tłumaczy" na ścieżkach błędu modułu
// administracyjnego.
//
// Ciało odpowiedzi niosło wcześniej `error.message` — zdanie wpisane w kodzie
// w jednym języku. Trafiało prosto na ekran (toastApiError czyta `message`),
// więc wybór języka w przeglądarce nie miał na nie wpływu. Testy pilnują obu
// połówek reguły naraz: na zewnątrz wychodzi kod (a tam, gdzie sam kod nie
// wystarcza — KLUCZ z parametrami), a treść wyjątku zostaje w logu.
//
// Asercje idą przez `toEqual` na PEŁNYM ciele, nie przez wyrywkowe `toBe` na
// jednym polu: brak `message` ma być DOWIEDZIONY, a nie domniemany — pole
// dopisane z powrotem musi ten test wywrócić.

import enSystemConfig from "@/locales/en/system-config.json"
import plSystemConfig from "@/locales/pl/system-config.json"
import {
  ModuleNotLicensedError,
  NativeApplicationImmutableError,
  type NativeApplicationImmutableReason,
  NativeCreationNotAllowedError,
  OpenwebuiGroupAlreadyMappedError,
  SelfLockoutError,
  type SelfLockoutReason,
  SystemRoleProtectedError,
} from "@cortex/service"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { NATIVE_IMMUTABLE_MESSAGE_KEYS, SELF_LOCKOUT_MESSAGE_KEYS, toErrorResponse } from "./guard"

/**
 * OBA języki, nie sam źródłowy. Klucz dołożony wyłącznie w `pl` nie wywala
 * niczego w runtime — angielski użytkownik dostaje wtedy zapas, czyli polskie
 * zdanie na ekranie po angielsku. Wersja czytająca sam `pl` przepuszczała
 * dokładnie ten przypadek.
 */
const BUNDLES = { pl: plSystemConfig, en: enSystemConfig } as Record<string, unknown>
const LOCALES = Object.keys(BUNDLES)

/** Zdanie z przestrzeni `system-config` po ścieżce klucza — bez i18next, bo tu
 *  sprawdzamy WYŁĄCZNIE, czy klucz w ogóle istnieje w pliku. */
function sentence(locale: string, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      BUNDLES[locale],
    )
}

/**
 * i18next interpoluje nie tylko `{{name}}`: po przecinku idzie formater
 * (`{{value, number}}`), a kropka sięga w głąb obiektu (`{{user.name}}`).
 * Wzorzec `\w+` gubił OBIE formy — czyli wąs, którego nikt nie wypełni,
 * przechodził asercję niżej i lądował surowy na ekranie. Zwracany jest KORZEŃ
 * ścieżki, bo to on musi się znaleźć w `messageParams`.
 */
function placeholderRoots(text: string): string[] {
  return [...text.matchAll(/{{\s*(-\s*)?([^{}]+?)\s*}}/g)].map(
    (match) => (match[2] ?? "").split(",")[0]!.trim().split(".")[0]!,
  )
}

interface ErrorCase {
  label: string
  error: unknown
  status: number
  body: { error: string; messageKey: string; messageParams?: Record<string, string> }
}

describe("placeholderRoots — co uchodzi za wąs do wypełnienia", () => {
  it("łapie prostą nazwę, formater po przecinku i ścieżkę w głąb obiektu", () => {
    expect(placeholderRoots("{{name}} / {{ role }}")).toEqual(["name", "role"])
    expect(placeholderRoots("{{value, number}} i {{date, datetime}}")).toEqual(["value", "date"])
    expect(placeholderRoots("{{user.name}} oraz {{- raw}}")).toEqual(["user", "raw"])
  })

  it("zdanie bez wąsów nie zgłasza niczego", () => {
    expect(placeholderRoots("Nie udało się zapisać ról.")).toEqual([])
  })
})

describe("toErrorResponse — konkret zostaje, ale jako KLUCZ, nie zdanie", () => {
  // Warianty samo-zablokowania i niezmienności wiersza natywnego są
  // WYPROWADZANE z map w `guard.ts`, nie przepisywane. Mapa jest
  // `Record<Reason, string>`, więc nowy powód w unii nie skompiluje się bez
  // wpisu — a skoro test czyta tę samą mapę, nowy wariant od razu wchodzi do
  // wszystkich asercji niżej. Ręczna literalka wymagała pamiętania o dopisaniu
  // go w drugim miejscu i milczała, gdy nikt nie pamiętał.
  const SELF_LOCKOUT_CASES: ErrorCase[] = Object.entries(SELF_LOCKOUT_MESSAGE_KEYS).map(
    ([reason, messageKey]) => ({
      label: `samo-zablokowanie [${reason}]`,
      // `message` celowo bez ogonków i bez związku z treścią klucza — gdyby
      // bramka przepuszczała je dalej, asercja `toEqual` niżej to pokaże.
      error: new SelfLockoutError(reason as SelfLockoutReason, "diagnostyka do logu"),
      status: 409,
      body: { error: "self-lockout", messageKey },
    }),
  )

  const NATIVE_IMMUTABLE_CASES: ErrorCase[] = Object.entries(NATIVE_IMMUTABLE_MESSAGE_KEYS).map(
    ([reason, messageKey]) => ({
      label: `wiersz natywny niezmienny [${reason}]`,
      error: new NativeApplicationImmutableError(
        reason as NativeApplicationImmutableReason,
        "diagnostyka do logu",
      ),
      status: 409,
      body: { error: "native-application-immutable", messageKey },
    }),
  )

  const CASES: ErrorCase[] = [
    ...SELF_LOCKOUT_CASES,
    {
      label: "rola systemowa chroniona przed usunięciem",
      error: new SystemRoleProtectedError("Administrator"),
      status: 409,
      body: {
        error: "system-role-protected",
        messageKey: "errors.systemRoleProtected",
        messageParams: { name: "Administrator" },
      },
    },
    {
      label: "kafelek natywny nie powstaje z formularza",
      error: new NativeCreationNotAllowedError(),
      status: 400,
      body: {
        error: "native-requires-activation",
        messageKey: "errors.nativeCreationNotAllowed",
      },
    },
    {
      label: "instancja nie ma licencji na ten moduł",
      error: new ModuleNotLicensedError("document-parser"),
      status: 403,
      body: {
        error: "module-not-licensed",
        messageKey: "errors.moduleNotLicensed",
        // Kod modułu to identyfikator, nie napis interfejsu.
        messageParams: { code: "document-parser" },
      },
    },
    {
      label: "grupa OpenWebUI stoi już za inną rolą",
      error: new OpenwebuiGroupAlreadyMappedError("konsultanci"),
      status: 409,
      body: {
        error: "openwebui-group-already-mapped",
        messageKey: "errors.openwebuiGroupAlreadyMapped",
        messageParams: { role: "konsultanci" },
      },
    },
    ...NATIVE_IMMUTABLE_CASES,
  ]

  // Wyprowadzenie z mapy niesie jedno ryzyko: mapa opróżniona albo zwężona
  // przestałaby cokolwiek sprawdzać, a `it.each([])` po prostu nie odpali
  // żadnego przypadku i zestaw wygląda na zielony.
  it("wyprowadzone przypadki realnie pokrywają obie mapy", () => {
    expect(SELF_LOCKOUT_CASES.length).toBeGreaterThanOrEqual(9)
    expect(NATIVE_IMMUTABLE_CASES.length).toBeGreaterThanOrEqual(2)
  })

  // Dziewięć wariantów samo-zablokowania to dziewięć różnych rad dla admina,
  // więc każdy musi trafić na WŁASNY klucz. Wspólny klucz dla wszystkich
  // przeszedłby asercję istnienia klucza i po cichu zamienił konkret
  // („odebrałeś sobie ostatnią rolę") na ogólnik — a przy przypadkach
  // wyprowadzanych z mapy jest to JEDYNE miejsce, które by to zauważyło.
  it("każdy wariant ma własny klucz, nie wspólny ogólnik", () => {
    const keys = CASES.map((testCase) => testCase.body.messageKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  // Drugie pół tej samej własności: klucz ma należeć DO SWOJEGO powodu.
  // Przestawienie dwóch wpisów w mapie zachowuje unikalność i bez tego
  // przechodziłoby — admin dostałby wtedy cudzą, sensownie brzmiącą radę.
  it.each([
    ...Object.entries(SELF_LOCKOUT_MESSAGE_KEYS),
    ...Object.entries(NATIVE_IMMUTABLE_MESSAGE_KEYS),
  ])("powód %s ma klucz nazwany po sobie", (reason, messageKey) => {
    const expected = reason.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())
    expect(messageKey.split(".").at(-1)).toBe(expected)
  })

  it.each(CASES)("$label: ciało niesie klucz, ZERO gotowych zdań", async (testCase) => {
    const response = toErrorResponse(testCase.error)

    expect(response.status).toBe(testCase.status)
    expect(await response.json()).toEqual(testCase.body)
  })

  /**
   * Bez tego literówka w `messageKey` byłaby NIEWIDOCZNA w runtime: klient
   * spadłby na zapas wołającego i pokazał ogólne „Nie udało się zapisać ról"
   * zamiast konkretu. Ekran wygląda wtedy na działający, a jedyna rzecz, którą
   * ta zmiana miała uratować, cicho ginie.
   */
  it.each(CASES.flatMap((testCase) => LOCALES.map((locale) => ({ ...testCase, locale }))))(
    "$label: klucz ISTNIEJE w $locale",
    (testCase) => {
      expect(typeof sentence(testCase.locale, testCase.body.messageKey)).toBe("string")
    },
  )

  // Parametry są UZUPEŁNIANE, nie zgadywane: klucz z `{{...}}`, którego nikt nie
  // wypełni, pokazałby użytkownikowi surowy wąs. Sprawdzane w obu językach —
  // tłumacz potrafi dołożyć wąs, którego w zdaniu źródłowym nie było.
  it.each(CASES.flatMap((testCase) => LOCALES.map((locale) => ({ ...testCase, locale }))))(
    "$label: klucz nie ma w $locale placeholdera bez parametru",
    (testCase) => {
      const text = sentence(testCase.locale, testCase.body.messageKey) as string
      const provided = Object.keys(testCase.body.messageParams ?? {})

      expect({
        bezParametru: placeholderRoots(text).filter((name) => !provided.includes(name)),
      }).toEqual({ bezParametru: [] })
    },
  )
})

describe("toErrorResponse — odpowiedzi bez zdania dla użytkownika", () => {
  it("błąd kształtu ciała zostaje samym kodem", async () => {
    const error = new z.ZodError([])

    const response = toErrorResponse(error)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid-request" })
  })

  it("naruszenie UNIQUE wraca jako 409 duplicate-code", async () => {
    const response = toErrorResponse({ code: "23505" })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "duplicate-code" })
  })

  it("nieznany wyjątek zostaje samym kodem — bez śladu treści w ciele", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("connection refused")

    const response = toErrorResponse(error)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "internal-error" })
    expect(logged).toHaveBeenCalledWith("[system-config] błąd obsługi żądania:", error)
    logged.mockRestore()
  })
})
