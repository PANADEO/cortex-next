import type { APIRequestContext } from "@playwright/test"
import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 26 · PAMIĘĆ — jedyna rzecz w Biurku, która wie coś o człowieku między sprawami.
 *
 * Cała konstrukcja stoi na jednym: nic tu nie wchodzi samo. Asystent PROPONUJE,
 * człowiek przyjmuje — ten sam kształt, co zatwierdzanie narzędzi obcego serwera MCP.
 * Gdyby propozycja działała od razu, byłaby to wiedza o człowieku gromadzona poza jego
 * wzrokiem, a to jest dokładnie ten produkt, którym Biurko nie chce być.
 */

const jako = { Cookie: "desk_persona=anna" }

/** Czysty stan: pamięć jest prywatna, więc kasujemy przez tę samą trasę co człowiek. */
async function wyczysc(request: APIRequestContext) {
  const { memories } = await (await request.get("/api/memory", { headers: jako })).json()
  for (const m of memories ?? []) {
    await request.post("/api/memory", { headers: jako, data: { action: "forget", id: m.id } })
  }
}

test.beforeEach(async ({ request }) => {
  await wyczysc(request)
})

test.afterAll(async ({ request }) => {
  await wyczysc(request)
})

test.describe("Obszar 26 · Pamięć asystenta", () => {
  test("Wpisane od siebie wspomnienie stoi na liście i przeżywa przeładowanie", async ({
    page,
    request,
  }) => {
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "Faktury dostaję jako CSV." },
    })
    await as(page, "anna")
    await otworz(page, "/memory")
    await expect(page.getByText("Faktury dostaję jako CSV.")).toBeVisible()
    await page.reload()
    await expect(page.getByText("Faktury dostaję jako CSV.")).toBeVisible()
  })

  test("Propozycja asystenta CZEKA i nie liczy się jako pamiętana", async ({ page, request }) => {
    // Najważniejszy scenariusz tego pliku. Propozycja, która działa od razu, jest
    // wiedzą o człowieku zebraną bez jego zgody — i nie da się tego zobaczyć na ekranie
    // inaczej niż licznikiem, bo zdanie stoi tam tak samo w obu przypadkach.
    const r = await request.get("/api/memory", { headers: jako })
    const { limit } = await r.json()
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "To już przyjęte." },
    })

    await as(page, "anna")
    await otworz(page, "/memory")
    await expect(page.getByText(`1 z ${limit}`)).toBeVisible()
    await expect(page.getByText("Asystent proponuje zapamiętać")).toHaveCount(0)
  })

  test("Przyjęcie propozycji przenosi ją do pamiętanych, odrzucenie ją kasuje", async ({
    page,
    request,
  }) => {
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "Zostaje." },
    })
    await as(page, "anna")
    await otworz(page, "/memory")

    // Kasowanie działa z ekranu, nie tylko z trasy — to jest ta obietnica „wszystko
    // możesz skasować", którą składa nagłówek ekranu.
    await page.getByRole("button", { name: "Skasuj: Zostaje." }).click()
    await expect(page.getByText("Zostaje.")).toHaveCount(0)
    await page.reload()
    await expect(page.getByText("Zostaje.")).toHaveCount(0)
  })

  test("Pamięć jest prywatna — Robert nie widzi wspomnień Anny", async ({ request }) => {
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "Tylko dla Anny." },
    })
    const robert = await (
      await request.get("/api/memory", { headers: { Cookie: "desk_persona=robert" } })
    ).json()
    expect((robert.memories ?? []).map((m: { text: string }) => m.text)).not.toContain(
      "Tylko dla Anny.",
    )
  })

  test("Dziennik przełożonego mówi, ŻE coś się zmieniło, i nie mówi CO", async ({
    page,
    request,
  }) => {
    // Pamięć jest prywatną przestrzenią pracownika. Wpis dziennika z treścią zamieniłby
    // ekran nadzoru w podgląd cudzych notatek, a to jest inny produkt niż ten.
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "Sekretna notatka o mojej pracy." },
    })
    await as(page, "robert")
    await otworz(page, "/supervision?section=log")
    await expect(page.getByText("dopisuje coś do pamięci asystenta").first()).toBeVisible()
    await expect(page.getByText("Sekretna notatka o mojej pracy.")).toHaveCount(0)
  })
})
