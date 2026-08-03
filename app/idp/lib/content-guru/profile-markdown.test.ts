// Testy jednostkowe czystych funkcji profil->Markdown (design doc D7 §4.3):
// "podgląd... dokładnie to, co realnie trafia do promptu" — te testy dowodzą
// kształtu wyjścia niezależnie od tego, gdzie funkcja jest wołana (server-side
// w /generate, client-side w podglądzie na ekranie profilu). Sam fakt, że oba
// miejsca IMPORTUJĄ tę samą funkcję (nie kopiują logiki) jest tym, co czyni
// podgląd "prowably identical" — weryfikowane też w
// app/idp/app/api/content-guru/generate/route.test.ts (Round B — wiązanie).

import { describe, expect, it } from "vitest"
import { clientProfileToMarkdown, marketProfileToMarkdown } from "./profile-markdown"

describe("clientProfileToMarkdown", () => {
  it("renderuje wyłącznie wypełnione pola, pomijając puste/null/undefined", () => {
    const markdown = clientProfileToMarkdown({
      profileName: "Acme Sp. z o.o.",
      history: "Na rynku od 2010.",
      description: null,
      // `products` celowo POMINIĘTE (nie `undefined` — exactOptionalPropertyTypes
      // odróżnia "klucz nieobecny" od "klucz z wartością undefined", tylko to
      // pierwsze jest osiągalne przez rzeczywistych wołających).
      offer: "",
      useCases: "  ",
      experience: "10 lat w branży.",
    })

    expect(markdown).toContain("Acme Sp. z o.o.")
    expect(markdown).toContain("Historia:")
    expect(markdown).toContain("Na rynku od 2010.")
    expect(markdown).toContain("Doświadczenie:")
    expect(markdown).toContain("10 lat w branży.")
    expect(markdown).not.toContain("Opis:")
    expect(markdown).not.toContain("Produkty:")
    expect(markdown).not.toContain("Oferta:")
    expect(markdown).not.toContain("Przypadki użycia:")
  })

  it("gdy WSZYSTKIE pola puste, zwraca samą nazwę profilu (nie pusty string)", () => {
    const markdown = clientProfileToMarkdown({ profileName: "Pusty profil" })
    expect(markdown).toBe("**Profil klienta: Pusty profil**")
  })
})

describe("marketProfileToMarkdown", () => {
  it("renderuje wyłącznie wypełnione pola", () => {
    const markdown = marketProfileToMarkdown({
      profileName: "Rynek IT B2B",
      description: null,
      sizeTrends: "Rośnie o 12% rocznie.",
      personas: null,
      problems: null,
      needs: "Automatyzacja procesów.",
      plans: null,
    })

    expect(markdown).toContain("Rynek IT B2B")
    expect(markdown).toContain("Wielkość rynku i trendy:")
    expect(markdown).toContain("Rośnie o 12% rocznie.")
    expect(markdown).toContain("Potrzeby:")
    expect(markdown).not.toContain("Opis:")
    expect(markdown).not.toContain("Persony:")
    expect(markdown).not.toContain("Problemy:")
    expect(markdown).not.toContain("Plany:")
  })

  it("gdy wszystkie pola puste, zwraca samą nazwę profilu", () => {
    const markdown = marketProfileToMarkdown({ profileName: "Pusty rynek" })
    expect(markdown).toBe("**Profil rynku: Pusty rynek**")
  })
})
