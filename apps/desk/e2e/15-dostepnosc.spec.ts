import type { Page } from "@playwright/test"
import {
  contrast,
  deskColors,
  FLOORS,
  KNOWN_BELOW,
  label,
  PAIRS,
  skinClasses,
  SKINS,
} from "../../../scripts/kontrast-tokenow.mjs"
import { as, expect, test } from "./osoby"

/**
 * Obrys skupienia jest jedyną rzeczą, po której osoba pracująca z klawiatury wie,
 * gdzie jest. Nie ma dla niego zamiennika i nie widać go na zrzucie ekranu, bo zrzut
 * robi się myszą — dlatego mierzymy go liczbą.
 *
 * DLACZEGO POWSTAŁ. Biurko brało obrys z `--ring` powłoki, a to 2,58:1 wobec białego
 * tła — poniżej progu 3:1 dla elementów nietekstowych. Nic tego nie zgłaszało: obrys
 * BYŁ, tylko prawie niewidoczny. Jedna linia w mostku tokenów odwraca to z powrotem.
 */
const CONTRAST_FLOOR = 3

/**
 * Wzór na kontrast przychodzi ze skryptu pomiarowego i to jest warunek, nie oszczędność:
 * dwie implementacje tej samej arytmetyki w jednym repozytorium to dwie liczby na jedno
 * pytanie, czyli dokładnie ten spór, po którym ten plik urósł.
 */
const parse = (color: string): number[] => (color.match(/\d+/g) ?? []).slice(0, 3).map(Number)

test.describe("Obszar 24 · Widać, gdzie jest kursor klawiatury", () => {
  test("Obrys skupienia ma kontrast wymagany dla elementów nietekstowych", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      const probe = document.createElement("div")
      document.body.appendChild(probe)
      const read = (token: string) => {
        probe.style.color = `hsl(${style.getPropertyValue(token)})`
        return getComputedStyle(probe).color
      }
      const out = {
        focus: read("--desk-focus"),
        background: read("--desk-bg"),
        surface: read("--desk-surface"),
      }
      probe.remove()
      return out
    })
    // Dwa tła, bo obrys pada i na dokument, i na karty — a to bywają inne kolory.
    expect(contrast(parse(colors.focus), parse(colors.background))).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR,
    )
    expect(contrast(parse(colors.focus), parse(colors.surface))).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR,
    )
  })

  test("Przejście Tabem naprawdę rysuje obrys, a nie tylko go deklaruje", async ({ page }) => {
    // Klasa `outline-none` Tailwinda ma tę samą swoistość co reguła skupienia w arkuszu
    // Biurka, więc o wyniku decyduje KOLEJNOŚĆ wczytania plików. To jest rzecz, o której
    // nie da się wnioskować z kodu — trzeba zapytać przeglądarki.
    await as(page, "anna")
    await page.goto("/files")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { width: style.outlineWidth, color: style.outlineColor, style: style.outlineStyle }
    })
    expect(outline.style).not.toBe("none")
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
    expect(outline.color).not.toContain("rgba(0, 0, 0, 0)")
  })

  test("Pola i paski przewijania Biurka idą za jego motywem", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const scheme = await page.evaluate(
      () => getComputedStyle(document.querySelector(".desk")!).colorScheme,
    )
    expect(scheme).toBe("light")
  })
})

/**
 * Obszar 24b · KONTRAST CAŁEJ PALETY — pomiar zamiast sporu.
 *
 * DLACZEGO POWSTAŁ. Konsylium podało dla tokenu `warn` dwie liczby naraz: 2,14:1
 * i 4,35:1. Obie były policzone dobrze i obie mierzyły co innego, bo `desk.css`
 * deklarował `--desk-warn` dwa razy — raz własną wartością Biurka, raz przez mostek
 * do powłoki — a widać było wyłącznie tę drugą. Rozbieżność jest defektem procesu:
 * karta błędu, limitu i awarii dziedziczy tę paletę, więc nie wolno projektować ich
 * na liczbie, której nikt nie umie odtworzyć.
 *
 * DLACZEGO POMIAR JEST TUTAJ, A NIE W TEŚCIE JEDNOSTKOWYM. Pytanie brzmi „jaki kolor
 * naprawdę zostanie namalowany”, a odpowiada na nie silnik renderujący: to on rozstrzyga
 * kaskadę, rozwija `var()` i liczy `color-mix(in oklab, …)`, z którego powstaje połowa
 * ról Biurka. Test jednostkowy odpowiadałby na pytanie „co ktoś sądzi, że jest w plikach”.
 * Listę par, listę skórek i progi bierzemy ze skryptu `scripts/kontrast-tokenow.mjs` —
 * tam jest źródło prawdy i tam się to samo liczy bez przeglądarki, gdy trzeba szybko.
 *
 * Kolor odczytujemy PRZEZ PŁÓTNO, a nie z `getComputedStyle`. To nie jest ostrożność
 * na wyrost: Chromium serializuje wynik `color-mix` jako `oklab(0.96 0.012 0.025)`,
 * więc wyciąganie z tego napisu trzech liczb regularnym wyrażeniem daje wartości
 * z zupełnie innej przestrzeni i wynik, który wygląda wiarygodnie. Płótno oddaje bajty.
 */
type Painted = Record<string, Record<string, number[]>>

async function paint(page: Page, expressions: string[]): Promise<Painted> {
  return page.evaluate(
    ({ skins, wanted }) => {
      const root = document.documentElement
      const original = root.className
      const probe = document.createElement("div")
      document.body.appendChild(probe)
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("brak kontekstu płótna — nie ma czym zmierzyć koloru")
      const out: Record<string, Record<string, number[]>> = {}
      for (const skin of skins) {
        root.className = [original, ...skin.classes].join(" ")
        const measured: Record<string, number[]> = {}
        for (const expression of wanted) {
          probe.style.color = ""
          probe.style.color = expression
          ctx.fillStyle = "#000000"
          ctx.fillStyle = getComputedStyle(probe).color
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          measured[expression] = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3)
        }
        out[skin.name] = measured
      }
      probe.remove()
      root.className = original
      return out
    },
    {
      skins: SKINS.map((skin) => ({ name: skin.name, classes: [...skin.classes] })),
      wanted: expressions,
    },
  )
}

const roles = deskColors()

/** Wyrażenie koloru dla roli — brak roli jest błędem pomiaru, nie zerem. */
function expression(key: string): string {
  const found = roles.get(key)
  if (!found) throw new Error(`konfiguracja Tailwinda nie zna roli ${key}`)
  return found
}

const number = (value: number) => value.toFixed(2).replace(".", ",")

/** Wszystkie odczyty: każda para w każdej skórce i w obu motywach. */
async function readings(page: Page) {
  const wanted = [...new Set(PAIRS.flatMap((pair) => [expression(pair.ink), expression(pair.ground)]))]
  const painted = await paint(page, wanted)
  return SKINS.flatMap((skin) => {
    const measured = painted[skin.name]
    if (!measured) throw new Error(`przeglądarka nie zmierzyła skórki ${skin.name}`)
    const read = (key: string) => {
      const found = measured[expression(key)]
      if (!found) throw new Error(`brak odczytu dla roli ${key} w skórce ${skin.name}`)
      return found
    }
    return PAIRS.map((pair) => ({
      where: `${skin.name} — ${label(pair)}`,
      ratio: contrast(read(pair.ink), read(pair.ground)),
      floor: FLOORS[pair.role],
      why: pair.why,
    }))
  })
}

/**
 * ODSTĘPSTWA ZNANE, POLICZONE I NIENAPRAWIONE — lista, która MOŻE TYLKO MALEĆ.
 *
 * Nie jest to wykaz rzeczy przemilczanych: każda pozycja ma zmierzoną liczbę i powód,
 * dla którego poprawka nie mieści się w zmianie samej wartości tokenu. Druga asercja
 * niżej pilnuje, żeby pozycja, która zaczęła przechodzić, MUSIAŁA stąd zniknąć —
 * inaczej lista cicho zamieniłaby się w wygodne miejsce na chowanie regresji.
 *
 * 1. `desk-muted-2` (12 pozycji, 2,59–3,42:1). Rola jest z definicji PRZYGASZONA
 *    względem `desk-muted`: `color-mix(… 68%, tło)`. Skoro sam `desk-muted` ma po
 *    poprawce 4,70:1, cokolwiek od niego bledszego jest poniżej progu — token nie da
 *    się naprawić, bo defekt jest w roli, nie w wartości. DECYZJA DLA CZŁOWIEKA:
 *    albo podpowiedź w polu i ikony przestają brać `desk-muted-2` (zmiana w kilkunastu
 *    komponentach, nie w tokenie), albo `--muted-foreground` schodzi do ~0 0% 32%,
 *    co przyciemnia KAŻDY podpis w produkcie i jest zmianą charakteru, nie poprawką.
 * 2. `desk-line-strong` (6 pozycji, 1,53–2,23:1). Jeden token robi dwie rzeczy:
 *    uchwyt paska przewijania (element sterowania — próg 3:1 obowiązuje, bo pasek jest
 *    stylowany przez nas, a nie przez przeglądarkę) i krawędź kafla przy najechaniu
 *    (ozdoba — próg nie obowiązuje). Podniesienie do progu wymaga ~35 12% 59% w jasnym
 *    i ~34 6% 45% w ciemnym, czyli krawędzi wyraźnie ciemniejszych niż dziś.
 *    DECYZJA DLA CZŁOWIEKA: rozdzielić token na uchwyt i krawędź, czy przyciemnić oba.
 * 3. `customs · jasny — desk-accent na desk-surface (tekst)` (3,23:1). To jest
 *    pomarańcz `20 95% 50%`, czyli sam charakter skórki „hi-vis”. Jako WYPEŁNIENIE
 *    przycisku przechodzi (3,23:1 przy progu 3:1) i tam zostaje; jako NAPIS wymagałby
 *    przyciemnienia marki. Nie ruszam — to jest decyzja właściciela skórki.
 */

test.describe("Obszar 24b · Paleta Biurka daje się przeczytać", () => {
  test("pomiar obejmuje realny zbiór ról i wszystkie skórki, a nie pusty", () => {
    // Bez tej asercji drobna zmiana w `tailwind.config.ts` albo nowa skórka w
    // `globals.css` dałaby test triumfalnie zielony, bo mierzący nic.
    expect(roles.size).toBeGreaterThanOrEqual(20)
    expect(PAIRS.length).toBeGreaterThanOrEqual(20)
    const measured = SKINS.flatMap((skin) => skin.classes)
    expect(skinClasses().filter((name) => !measured.includes(name))).toEqual([])
  })

  test("każda para „treść na swoim tle” ma kontrast wymagany przez WCAG", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const below = (await readings(page)).filter((one) => one.ratio < one.floor)
    // Komunikat wymienia parę Z NAZWY razem z liczbą i miejscem w kodzie. „Coś nie
    // przechodzi” zmusiłoby następną osobę do powtórzenia całego pomiaru od zera.
    expect(
      below
        .filter((one) => !KNOWN_BELOW.includes(one.where))
        .map((one) => `${one.where}: ${number(one.ratio)}:1 poniżej progu ${number(one.floor)}:1 — ${one.why}`),
    ).toEqual([])
  })

  test("lista znanych odstępstw może tylko maleć", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const below = await readings(page).then((all) => all.filter((one) => one.ratio < one.floor))
    expect(KNOWN_BELOW.filter((known) => !below.some((one) => one.where === known))).toEqual([])
  })
})
