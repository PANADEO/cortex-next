// @vitest-environment jsdom
//
// Sedno asysty AI siedzi w stanie strony, nie w prompt-builderze: która trójka
// przycisków jest widoczna, co ląduje w `avoid` przy kolejnym kliknięciu i czy
// "Cofnij" wraca do tekstu usera. Tego czyste funkcje nie łapią.

import type { AssistRequestDto } from "@/features/ilustromat/types"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const assistCalls: AssistRequestDto[] = []
let assistReply = "wynik AI"
let assistRejects = false

const idleMutation = {
  mutateAsync: vi.fn(async () => undefined),
  isPending: false,
  variables: undefined,
}

vi.mock("@/features/ilustromat/hooks", () => ({
  useFrameTemplates: () => ({ data: [{ id: "tpl-1", name: "Crido — fioletowa" }] }),
  useGenerate: () => idleMutation,
  useCompose: () => idleMutation,
  useAssistText: () => ({
    isPending: false,
    variables: undefined,
    mutateAsync: async (body: AssistRequestDto) => {
      assistCalls.push(body)
      if (assistRejects) throw new Error("upstream padł")
      return { text: assistReply }
    },
  }),
}))

vi.mock("@cortex/api", () => ({ toastApiError: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import GenerationPage from "./page"

beforeEach(() => {
  assistCalls.length = 0
  assistReply = "wynik AI"
  assistRejects = false
})

afterEach(cleanup)

function titleInput() {
  return screen.getByLabelText("Tytuł") as HTMLInputElement
}

function subtitleInput() {
  return screen.getByLabelText("Podtytuł") as HTMLInputElement
}

/** Repo nie ładuje matcherów jest-dom globalnie — czytamy `disabled` wprost. */
function assistButton(name: RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement
}

describe("asysta AI w formularzu generowania", () => {
  it("przyciski tytułu są nieaktywne, dopóki nie ma tekstu", async () => {
    render(<GenerationPage />)

    expect(assistButton(/Dopracuj/).disabled).toBe(true)
    expect(assistButton(/Inna wersja/).disabled).toBe(true)

    await userEvent.type(titleInput(), "Ceny transferowe 2027")

    expect(assistButton(/Dopracuj/).disabled).toBe(false)
    expect(assistButton(/Inna wersja/).disabled).toBe(false)
  })

  it("pusty podtytuł dostaje Podpowiedz, wypełniony — Dopracuj i Inną wersję", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "Ceny transferowe 2027")

    // Pusty podtytuł: jedno "Podpowiedz" przy podtytule + jedno przy pomyśle.
    expect(screen.getAllByRole("button", { name: /Podpowiedz/ })).toHaveLength(2)

    await userEvent.type(subtitleInput(), "Co musisz wiedzieć")

    // Po wpisaniu zostaje już tylko to przy pomyśle na ilustrację.
    expect(screen.getAllByRole("button", { name: /Podpowiedz/ })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: /Dopracuj/ })).toHaveLength(2)
  })

  it("Dopracuj podmienia tytuł i nie wysyła listy odrzuconych", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "ceny transferowe")
    assistReply = "Ceny transferowe 2027: co się zmienia"

    await userEvent.click(screen.getByRole("button", { name: /Dopracuj/ }))

    await waitFor(() => expect(titleInput().value).toBe("Ceny transferowe 2027: co się zmienia"))
    expect(assistCalls[0]).toMatchObject({ field: "title", mode: "polish", avoid: [] })
  })

  it("kolejne Inne wersje dokładają poprzednie propozycje do avoid", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "wersja usera")

    assistReply = "wersja AI 1"
    await userEvent.click(screen.getByRole("button", { name: /Inna wersja/ }))
    await waitFor(() => expect(titleInput().value).toBe("wersja AI 1"))

    assistReply = "wersja AI 2"
    await userEvent.click(screen.getByRole("button", { name: /Inna wersja/ }))
    await waitFor(() => expect(titleInput().value).toBe("wersja AI 2"))

    expect(assistCalls[0]!.avoid).toEqual([])
    // Zastąpiony tekst usera ORAZ pokazana propozycja — kolejne kliknięcie ma
    // uciec od obu, nie zawrócić do punktu wyjścia.
    expect(assistCalls[1]!.avoid).toEqual(["wersja usera", "wersja AI 1"])
  })

  it("Cofnij wraca do tekstu sprzed zmiany i znika po użyciu", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "mój własny tytuł")

    expect(screen.queryByRole("button", { name: /Cofnij/ })).toBeNull()

    assistReply = "tytuł od AI"
    await userEvent.click(screen.getByRole("button", { name: /Dopracuj/ }))
    await waitFor(() => expect(titleInput().value).toBe("tytuł od AI"))

    await userEvent.click(screen.getByRole("button", { name: /Cofnij/ }))

    expect(titleInput().value).toBe("mój własny tytuł")
    expect(screen.queryByRole("button", { name: /Cofnij/ })).toBeNull()
  })

  it("Podpowiedz dla pomysłu wysyła kontekst zamiast treści pola", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "Kontrola podatkowa")
    await userEvent.type(subtitleInput(), "Jak się przygotować")

    assistReply = "Lampa oświetlająca stos teczek na ciemnym biurku"
    await userEvent.click(screen.getByRole("button", { name: /Podpowiedz/ }))

    await waitFor(() => expect(assistCalls).toHaveLength(1))
    expect(assistCalls[0]).toMatchObject({
      field: "idea",
      mode: "propose",
      context: { title: "Kontrola podatkowa", subtitle: "Jak się przygotować" },
    })
  })

  it("nieudane wywołanie nie rusza pola ani nie zostawia Cofnij", async () => {
    render(<GenerationPage />)
    await userEvent.type(titleInput(), "tytuł usera")
    assistRejects = true

    await userEvent.click(screen.getByRole("button", { name: /Dopracuj/ }))

    await waitFor(() => expect(assistCalls).toHaveLength(1))
    expect(titleInput().value).toBe("tytuł usera")
    expect(screen.queryByRole("button", { name: /Cofnij/ })).toBeNull()
  })
})
