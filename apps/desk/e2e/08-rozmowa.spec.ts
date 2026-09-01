import { as, expect, test } from "./osoby"

test.describe("Obszar 8 · Rozmowa, którą da się prowadzić", () => {
  test(
    "Zaznaczenie tekstu przeżywa odświeżanie w tle",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(120_000)
      await as(page, "anna")
      const r = await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=anna" },
        data: { title: "Zaznaczanie" },
      })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers: { Cookie: "desk_persona=anna" },
        data: { text: "Napisz jedno zdanie o kotach. Nie zapisuj żadnego pliku." },
      })
      await page.goto(`/case/${id}`)

      const babel = page.getByText("Napisz jedno zdanie o kotach", { exact: false })
      await expect(babel).toBeVisible({ timeout: 60_000 })

      await babel.evaluate((el) => {
        const z = document.createRange()
        z.selectNodeContents(el)
        const s = window.getSelection()
        s?.removeAllRanges()
        s?.addRange(z)
      })
      expect(
        (await page.evaluate(() => window.getSelection()?.toString() ?? "")).length,
      ).toBeGreaterThan(10)

      // odpytywanie chodzi w tle; zaznaczenie ma je przetrwać, bo inaczej nie da się skopiować tekstu
      await page.waitForTimeout(4000)
      const po = await page.evaluate(() => window.getSelection()?.toString() ?? "")
      expect(po.length).toBeGreaterThan(10)
    },
  )

  test(
    "Polecenie stoi po prawej, odpowiedź po lewej",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(120_000)
      await as(page, "anna")
      const r = await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=anna" },
        data: { title: "Strony" },
      })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers: { Cookie: "desk_persona=anna" },
        data: { text: "Powiedz krótko, ile to jest dwa plus dwa. Nie zapisuj pliku." },
      })
      await page.goto(`/case/${id}`)

      const command = page.getByText("ile to jest dwa plus dwa", { exact: false })
      await expect(command).toBeVisible({ timeout: 60_000 })

      const stream = page.locator("main .max-w-desk-stream").first()
      const p = await command.boundingBox()
      const s = await stream.boundingBox()
      expect(p && s).toBeTruthy()
      // prawa krawędź bąbla dochodzi do prawej krawędzi kolumny, lewa jest wyraźnie od niej odsunięta
      expect(p!.x + p!.width).toBeGreaterThan(s!.x + s!.width - 40)
      expect(p!.x).toBeGreaterThan(s!.x + 60)
    },
  )

  test(
    "Agent odpowiada na zwykłe pytanie, zamiast odsyłać do plików",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(120_000)
      await as(page, "anna")
      const r = await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=anna" },
        data: { title: "Pytanie ogólne" },
      })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers: { Cookie: "desk_persona=anna" },
        data: { text: "Jaka jest stawka podstawowa VAT w Polsce?" },
      })
      await page.goto(`/case/${id}`)
      await expect(page.getByText("23")).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText(/nie mam dostępu|mogę tylko pracować na/i)).toHaveCount(0)
    },
  )

  test("Panel wyniku da się schować i zostaje schowany", async ({ page, request }) => {
    await as(page, "anna")
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Panel" },
    })
    const { id } = await r.json()
    await page.goto(`/case/${id}`)

    const schowaj = page.getByRole("button", { name: "Ukryj panel wyniku" })
    await expect(schowaj).toBeVisible()
    await schowaj.click()
    await expect(page.getByRole("button", { name: "Pokaż panel wyniku" })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("button", { name: "Pokaż panel wyniku" })).toBeVisible()
    await page.getByRole("button", { name: "Pokaż panel wyniku" }).click()
    await expect(page.getByRole("button", { name: "Ukryj panel wyniku" })).toBeVisible()
  })

  test("Wskaźnik pracy pojawia się od razu po wysłaniu, nie po pierwszym kroku", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    await as(page, "anna")
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Wskaźnik" },
    })
    const { id } = await r.json()
    await page.goto(`/case/${id}`)
    await page.getByPlaceholder("Napisz, co mam zrobić…").fill("Opowiedz dowcip o księgowym.")
    await page.getByRole("button", { name: "Wyślij zlecenie" }).click()
    // bez optymistycznego wpisu ten napis pojawiłby się dopiero po odpytaniu, czyli z opóźnieniem
    await expect(page.getByText("Zabieram się do pracy…")).toBeVisible({ timeout: 1500 })
  })

  test('Popover „Co potrafię" mieści się w oknie', async ({ page }) => {
    await as(page, "anna")
    await page.setViewportSize({ width: 1280, height: 620 })
    await page.goto("/")
    await page.getByRole("button", { name: /Umiem tu/ }).click()
    const text = page.getByText("Na to nie masz jeszcze zgody:")
    await expect(text).toBeVisible()
    const box = await page.locator("[data-radix-popper-content-wrapper]").first().boundingBox()
    expect(box).toBeTruthy()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(620 + 1)
  })
})

test.describe('Obszar 9 · „Moje pliki" to przestrzeń świadomych decyzji', () => {
  test("Załącznik do rozmowy trafia do teczki sprawy, nie do Moich plików", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    await as(page, "anna")
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Załącznik" },
    })
    const { id } = await r.json()

    await page.goto(`/case/${id}`)
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "zalacznik-testowy.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("zawartość załącznika"),
      })
    // kafelek załącznika stoi w polu pisania, zanim cokolwiek wyślemy
    await expect(page.getByText("zalacznik-testowy.txt")).toBeVisible()

    const files = await (
      await request.get("/api/files", { headers: { Cookie: "desk_persona=anna" } })
    ).json()
    const wMoichPlikach = (files.files ?? []).some(
      (x: { name: string }) => x.name === "zalacznik-testowy.txt",
    )
    expect(wMoichPlikach).toBe(false)

    const folder = await (
      await request.get(`/api/case/${id}/events?od=0`, {
        headers: { Cookie: "desk_persona=anna" },
      })
    ).json()
    expect(
      (folder.folder ?? []).some((x: { name: string }) => x.name === "zalacznik-testowy.txt"),
    ).toBe(true)
  })

  test(
    "Agent odkłada plik do Moich plików dopiero na wyraźną prośbę",
    { tag: "@model" },
    async ({ request }) => {
      test.setTimeout(180_000)
      const headers = { Cookie: "desk_persona=anna" }
      const r = await request.post("/api/case/new", { headers, data: { title: "Odkładanie" } })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers,
        data: {
          text: "Zapisz plik notatka-testowa.md z jednym zdaniem o kosztach, a potem odłóż go do Moich plików.",
        },
      })

      let status = "working"
      for (let i = 0; i < 80 && status === "working"; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const d = await (await request.get(`/api/case/${id}/events?od=0`, { headers })).json()
        status = d.caseFile.status
      }
      const d = await (await request.get(`/api/case/${id}/events?od=0`, { headers })).json()
      const uzyte = d.events
        .filter((z: { event: { type: string } }) => z.event.type === "tool_start")
        .map((z: { event: { name: string } }) => z.event.name)
      expect(uzyte).toContain("save_to_my_files")

      const files = await (await request.get("/api/files", { headers })).json()
      expect(
        (files.files ?? []).some((x: { name: string }) => x.name.startsWith("notatka-testowa")),
      ).toBe(true)

      // sprzątamy, żeby kolejny przebieg zastał to samo biurko
      for (const p of files.files ?? []) {
        if (p.name.startsWith("notatka-testowa")) {
          await request.post("/api/files", { headers, data: { action: "trash", path: p.path } })
        }
      }
    },
  )
})
