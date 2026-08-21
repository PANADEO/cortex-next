// Kontrakt "serwer oddaje KOD, klient tłumaczy" na ścieżkach błędu bramki.
//
// Ciało odpowiedzi niosło wcześniej `error.message` — zdanie wpisane w kodzie
// w jednym języku. Trafiało prosto na ekran, więc wybór języka w przeglądarce
// nie miał na nie wpływu. Testy pilnują obu połówek reguły naraz: na zewnątrz
// wychodzi kod (a tam, gdzie sam kod nie wystarcza — KLUCZ z parametrami),
// a treść wyjątku zostaje w logu.
//
// Asercje idą przez `toEqual` na PEŁNYM ciele, nie przez wyrywkowe `toBe` na
// jednym polu: brak `message` ma być DOWIEDZIONY, a nie domniemany — pole
// dopisane z powrotem musi ten test wywrócić.

import { InvalidColorError } from "@/lib/ilustromat/color"
import { MissingFontFileError } from "@/lib/ilustromat/composer"
import { UnreadableFontError } from "@/lib/ilustromat/glyph-coverage"
import { InvalidLogoError } from "@/lib/ilustromat/logo"
import { IncompleteCustomFontError, TemplateNotFoundError } from "@/lib/ilustromat/render"
import plIlustromat from "@/locales/pl/ilustromat.json"
import { UnknownTemplateError } from "@cortex/service"
import { describe, expect, it, vi } from "vitest"
import { toErrorResponse, toUpstreamErrorResponse } from "./guard"

describe("toUpstreamErrorResponse", () => {
  it("oddaje sam kod błędu, a treść wyjątku kieruje do logu", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("Cortex Proxy returned 500")

    const response = toUpstreamErrorResponse(error)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "upstream-error" })
    expect(logged).toHaveBeenCalledWith("[ilustromat] błąd cortex-proxy:", error)
    logged.mockRestore()
  })
})

/** Zdanie z przestrzeni `ilustromat` po ścieżce klucza — bez i18next, bo tu
 *  sprawdzamy WYŁĄCZNIE, czy klucz w ogóle istnieje w pliku źródłowym. */
function sourceSentence(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      plIlustromat as unknown,
    )
}

describe("toErrorResponse — konkret zostaje, ale jako KLUCZ, nie zdanie", () => {
  // Odpowiednik `messageKey` -> parametry, których zdanie realnie używa.
  // Literały to fragmenty NAZW PLIKÓW i identyfikatorów, nie napisy interfejsu.
  const CASES = [
    {
      label: "nie ma szablonu (warstwa renderu)",
      error: new TemplateNotFoundError("crido-violet"),
      status: 404,
      body: {
        error: "not-found",
        messageKey: "errors.templateMissing",
        messageParams: { id: "crido-violet" },
      },
    },
    {
      label: "nie ma szablonu (warstwa serwisowa)",
      error: new UnknownTemplateError("crido-violet"),
      status: 404,
      body: {
        error: "not-found",
        messageKey: "errors.templateMissing",
        messageParams: { id: "crido-violet" },
      },
    },
    {
      label: "plik fontu nie daje się sparsować",
      error: new UnreadableFontError("unparsable", "unknown font format"),
      status: 400,
      body: {
        error: "invalid-asset",
        messageKey: "errors.fontUnparsable",
        messageParams: { detail: "unknown font format" },
      },
    },
    {
      label: "wgrano kolekcję krojów zamiast pojedynczego pliku",
      error: new UnreadableFontError("font-collection"),
      status: 400,
      body: {
        error: "invalid-asset",
        messageKey: "errors.fontCollection",
        messageParams: { detail: "" },
      },
    },
    {
      label: "plik fontu bez nazwy rodziny",
      error: new UnreadableFontError("no-family-name"),
      status: 400,
      body: {
        error: "invalid-asset",
        messageKey: "errors.fontNoFamilyName",
        messageParams: { detail: "" },
      },
    },
    {
      label: "pliku logo nie da się odczytać",
      error: new InvalidLogoError("Input buffer contains unsupported image format"),
      status: 400,
      body: {
        error: "invalid-asset",
        messageKey: "errors.logoUnreadable",
        messageParams: { detail: "Input buffer contains unsupported image format" },
      },
    },
    {
      label: "kolor spoza formatu #RRGGBB",
      error: new InvalidColorError("fiolet"),
      status: 400,
      body: {
        error: "invalid-asset",
        messageKey: "errors.invalidColor",
        messageParams: { value: "fiolet" },
      },
    },
  ] as const

  it.each(CASES)("$label: ciało niesie klucz i parametry, ZERO gotowych zdań", async (testCase) => {
    const response = toErrorResponse(testCase.error)

    expect(response.status).toBe(testCase.status)
    expect(await response.json()).toEqual(testCase.body)
  })

  // Brakujący plik fontu to niespójny STAN szablonu, nie zły request — stąd
  // 500 i wpis do logu. Zdanie dla użytkownika i tak powstaje na kliencie.
  const STATE_CASES = [
    {
      label: "plik fontu zniknął z dysku",
      error: new MissingFontFileError("/fonts/brand-bold.ttf"),
      body: {
        error: "template-font-missing",
        messageKey: "errors.fontFileMissing",
        messageParams: { path: "/fonts/brand-bold.ttf" },
      },
    },
    {
      label: "własny font bez jednej z odmian",
      error: new IncompleteCustomFontError("crido-violet", "font-bold"),
      body: {
        error: "template-font-missing",
        messageKey: "errors.incompleteCustomFont",
        messageParams: { id: "crido-violet", kind: "font-bold" },
      },
    },
  ] as const

  it.each(STATE_CASES)("$label: 500 z kluczem, diagnostyka do logu", async (testCase) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = toErrorResponse(testCase.error)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual(testCase.body)
    expect(logged).toHaveBeenCalledWith(
      "[ilustromat] szablon bez kompletu plików fontu:",
      testCase.error,
    )
    logged.mockRestore()
  })

  /**
   * Bez tego literówka w `messageKey` byłaby NIEWIDOCZNA w runtime: klient
   * spadłby na zapas wołającego i pokazał ogólne „Nie udało się zapisać
   * szablonu" zamiast konkretu. Ekran wygląda wtedy na działający, a jedyna
   * rzecz, którą ta zmiana miała uratować, cicho ginie.
   */
  it.each([...CASES, ...STATE_CASES])("$label: klucz ISTNIEJE w pliku źródłowym", (testCase) => {
    expect(typeof sourceSentence(testCase.body.messageKey)).toBe("string")
  })

  it("nieznany wyjątek zostaje samym kodem — bez śladu treści w ciele", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = toErrorResponse(new Error("connection refused"))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "internal-error" })
    logged.mockRestore()
  })
})
