import CAPABILITIES from "../../../packages/@cortex/desk-core/seed/capabilities.json"
import PL from "../../../packages/@cortex/desk-ui/src/i18n/pl.json"

/** Nazwy działów bierzemy ze SŁOWNIKA — ten sam napis, który widzi człowiek. */
const NAZWY_DZIALOW = PL.capability.department
import { as, expect, otworz, test } from "./osoby"

// zestaw zakłada Annę bez indywidualnych nadań — poprzedni przebieg mógł jej coś przyznać
test.beforeAll(async ({ request }) => {
  await request.post("/api/test/reset-permissions", { headers: { Cookie: "desk_persona=robert" } })
})

test.describe("Obszar 5 · Zdolności stopniowane wg roli", () => {
  test("Dwie role, dwa zestawy", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await expect(page.getByText("Tworzenie dokumentów")).toBeVisible()
    await expect(page.getByText("Uruchamianie obliczeń")).toBeVisible()
    // Liczba kłódek WYPROWADZONA Z ZASIEWU, nie wpisana. Stała tu piątka i pękła w dniu,
    // w którym rola startowa dostała arkusze i obliczenia — a to jest decyzja, która
    // będzie zapadać jeszcze nieraz i przy każdym kliencie inaczej. Test ma pilnować
    // REGUŁY („czego nie masz, o to prosisz"), nie zapamiętanego stanu zasiewu.
    const zamkniete = CAPABILITIES.capabilities.filter(
      (one: { id: string }) => !CAPABILITIES.roles.member.includes(one.id),
    )
    expect(zamkniete.length, "zasiew bez ani jednej kłódki nie sprawdza niczego").toBeGreaterThan(0)
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(
      zamkniete.length,
    )

    await as(page, "robert")
    await otworz(page, "/capabilities")
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(0)
    await expect(page.getByText("Generowanie obrazów")).toBeVisible()
  })

  test("Zablokowana zdolność pokazuje dział-właściciela", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    // Działy WYPROWADZONE Z ZASIEWU, nie wpisane. Stały tu „Marketing" i „IT"; drugi
    // wypadł 02.09.2026 razem z `code.run`, które weszło do roli startowej. Podstawienie
    // innej nazwy naprawiłoby ten test do następnej takiej decyzji — a te będą zapadać
    // przy każdym kliencie. Test ma pilnować REGUŁY: przy każdej kłódce widać, czyja
    // to zgoda.
    const zamkniete = CAPABILITIES.capabilities.filter(
      (one: { id: string }) => !CAPABILITIES.roles.member.includes(one.id),
    )
    const dzialy = [...new Set(zamkniete.map((one: { department: string }) => one.department))]
    expect(dzialy.length, "bez ani jednego zamkniętego działu test nie sprawdza niczego")
      .toBeGreaterThan(0)
    for (const dzial of dzialy) {
      const nazwa = NAZWY_DZIALOW[dzial as keyof typeof NAZWY_DZIALOW]
      await expect(page.getByText(`zgoda należy do działu: ${nazwa}`)).toBeVisible()
    }
  })

  test("Prośba o dostęp zostawia potwierdzenie", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await page.getByRole("button", { name: "Poproś o dostęp" }).first().click()
    await expect(page.getByText("Prośba wysłana — czeka na rozpatrzenie")).toBeVisible()
  })

  test("Zdolności są też pod ręką przy polu zlecenia", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/")
    // Bez liczby: katalog zdolności rośnie, a ten scenariusz jest o TYM, że lista
    // stoi pod ręką przy polu zlecenia — nie o tym, ile pozycji akurat ma.
    await page.getByRole("button", { name: /Umiem tu/ }).click()
    await expect(page.getByText("Na to nie masz jeszcze zgody:")).toBeVisible()
    await expect(page.getByText("Generowanie obrazów")).toBeVisible()
  })

  test("Model nie dostaje narzędzia spoza roli", async ({ request }) => {
    const r = await request.get("/api/files", { headers: { Cookie: "desk_persona=anna" } })
    expect(r.ok()).toBeTruthy()
    // kontrakt bramy: Anna ma 4 zdolności, więc rejestr modelu ma 4 narzędzia
    // (sprawdzane bezpośrednio na polityce w tescie jednostkowym bramy)
  })
})
