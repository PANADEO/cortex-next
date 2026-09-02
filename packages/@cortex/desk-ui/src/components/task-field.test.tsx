// @vitest-environment jsdom
//
// POLE ZLECENIA MA JEDNĄ POSTAĆ — i to jest jedyna rzecz, której ten plik pilnuje.
//
// DLACZEGO POWSTAŁ. Pole miało na biurku trzy postacie zależne od LICZBY SPRAW (karty,
// chipy, zwinięte „Podpowiedzi”), a na dole sprawy czwartą — własny kawałek kodu, o innej
// wysokości, z innym napisem na przycisku i innym tekstem zastępczym. Ten sam ekran
// wyglądał w poniedziałek inaczej niż w piątek. Pani Basia uczy się ekranu RAZ; ekran,
// który zmienia postać w tle, jest dla niej ekranem, którego nie umie.
//
// CZEGO PILNUJE, w kolejności ważności:
//   1. postać pola nie zależy od szerokości okna — ani przez gałąź w kodzie (rysunek jest
//      identyczny przy 360, 768 i 1440 px, przy `matchMedia` odpowiadającym na te
//      szerokości zgodnie z prawdą), ani przez arkusz stylów (w drzewie pola nie ma ANI
//      JEDNEJ klasy z przedrostkiem szerokości — to jedyna droga, którą druga postać
//      mogłaby tu wrócić po cichu, bo jej test rysunku nie widzi);
//   2. etykieta stoi nad polem i NIE ZNIKA po pierwszej literze — a pole nie ma tekstu
//      zastępczego, bo to on znikał razem z jedyną instrukcją, jaką ta osoba miała;
//   3. przycisk wysyłki niesie SŁOWO ze słownika, nie samą strzałkę;
//   4. biurko i dół sprawy używają TEGO SAMEGO komponentu — bo „jedna postać” utrzymana
//      przez dwie kopie kodu rozjeżdża się przy pierwszym pośpiechu.
//
// CZEGO NIE ŁAPIE, powiedziane wprost: układu liczonego przez przeglądarkę. jsdom nie
// mierzy pikseli. Gdyby postać pola zmieniał sam silnik układu (zawijanie paska narzędzi),
// zobaczy to dopiero Playwright.

import type { Policy } from "@cortex/desk-core/types"
import "@testing-library/jest-dom/vitest"
import { render, within, type RenderResult } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeskLocaleProvider } from "../i18n/client"
import { DESK_LOCALES, makeDeskT, type DeskLocale } from "../i18n/locale"
import { Composer } from "./composer"
import { TaskField } from "./task-field"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

const here = path.dirname(fileURLToPath(import.meta.url))

const policy: Policy = {
  user: "anna",
  role: "member",
  granted: [],
  blocked: [],
  dailyLimitUsd: 5,
  fingerprint: "test",
}

/** Szerokości, na których ten produkt naprawdę stoi: telefon, tablet, biurko. */
const WIDTHS = [360, 768, 1440]

/**
 * Okno o zadanej szerokości — RAZEM z `matchMedia`, które odpowiada na pytania o nią
 * zgodnie z prawdą. Bez tego drugiego test byłby zielony z niewłaściwego powodu:
 * `matchMedia` z jsdom odpowiada „nie” na wszystko, więc gałąź zależna od szerokości
 * nigdy by się nie odpaliła i nie miałaby jak się pokazać.
 */
function atWidth(px: number) {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true })
  const minimum = /min-width:\s*(\d+)px/
  const maximum = /max-width:\s*(\d+)px/
  window.matchMedia = ((query: string) => {
    const low = minimum.exec(query)
    const high = maximum.exec(query)
    const matches = low
      ? px >= Number(low[1])
      : high
        ? px <= Number(high[1])
        : query.includes("hover: hover") && px >= 1024
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
  window.dispatchEvent(new Event("resize"))
}

/** Rysunek drzewa: znaczniki i własny tekst. Identyfikatory pomijamy — `useId` je zmienia. */
function outline(root: HTMLElement): string {
  const lines: string[] = []
  const walk = (node: Element, depth: number) => {
    const own = [...node.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? "").trim())
      .filter(Boolean)
      .join(" ")
    lines.push(`${"  ".repeat(depth)}${node.tagName.toLowerCase()}${own ? ` = ${own}` : ""}`)
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return lines.join("\n")
}

/**
 * Przedrostek szerokości w klasie: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`, ich odmiany `max-*`
 * i zapytanie o szerokość wpisane wprost. Świadomie NIE łapiemy `[@media(hover:none)]` —
 * to pytanie o rodzaj wskaźnika, a nie o szerokość okna, i wolno je zadawać.
 */
const WIDTH_VARIANT = /(?:^|:)(?:max-)?(?:sm|md|lg|xl|2xl):|@media\s*\((?:min|max)-width/

const classesIn = (root: HTMLElement): string[] =>
  [root, ...root.querySelectorAll("*")]
    .flatMap((el) => (el.getAttribute("class") ?? "").split(/\s+/))
    .filter(Boolean)

const FILES = [{ name: "faktury.csv" }]

function showField(locale: DeskLocale, text: string): RenderResult {
  const box = createRef<HTMLTextAreaElement>()
  return render(
    <DeskLocaleProvider locale={locale}>
      <TaskField
        text={text}
        onText={() => {}}
        hint={makeDeskT(locale)("case.example")}
        box={box}
        busy={false}
        files={FILES}
        removeFile={() => {}}
        onFiles={() => {}}
        onSend={() => {}}
        policyFor={policy}
      />
    </DeskLocaleProvider>,
  )
}

const showComposer = (): RenderResult =>
  render(
    <DeskLocaleProvider locale="pl">
      <Composer
        quickTasks={["expensesDocument", "meetingNotes", "documentGaps"]}
        policyFor={policy}
      />
    </DeskLocaleProvider>,
  )

beforeEach(() => atWidth(1440))

describe("postać pola zlecenia nie zależy od szerokości okna", () => {
  it("pole rysuje się tak samo na telefonie, na tablecie i na biurku", () => {
    const drawings = WIDTHS.map((px) => {
      atWidth(px)
      const view = showField("pl", "")
      const drawing = outline(view.container)
      view.unmount()
      return { px, drawing }
    })
    const first = drawings[0]
    expect(first).toBeDefined()
    for (const other of drawings.slice(1)) {
      expect(other.drawing, `pole ma inną postać przy ${other.px} px`).toBe(first?.drawing)
    }
  })

  it("cały ekran biurka rysuje się tak samo, razem z gotowymi zleceniami", () => {
    const drawings = WIDTHS.map((px) => {
      atWidth(px)
      const view = showComposer()
      const drawing = outline(view.container)
      view.unmount()
      return { px, drawing }
    })
    const first = drawings[0]
    for (const other of drawings.slice(1)) {
      expect(other.drawing, `biurko ma inną postać przy ${other.px} px`).toBe(first?.drawing)
    }
  })

  it("wszystkie trzy gotowe zlecenia stoją na wierzchu, bez rozwijania", () => {
    // Postać wcześniej zależała od LICZBY SPRAW: karty, chipy, zwinięta lista. Dziś pole
    // nie wie, ile ktoś ma spraw — nie ma czego zwijać, więc nie ma trzeciej postaci.
    const translate = makeDeskT("pl")
    const view = showComposer()
    for (const id of ["expensesDocument", "meetingNotes", "documentGaps"]) {
      expect(
        within(view.container).getByText(translate(`quickTask.${id}.title`)),
      ).toBeInTheDocument()
    }
    expect(within(view.container).queryByRole("button", { name: "Podpowiedzi" })).toBeNull()
    view.unmount()
  })

  it("w drzewie pola nie ma ani jednej klasy zależnej od szerokości", () => {
    const view = showField("pl", "Policz koszty")
    const guilty = classesIn(view.container).filter((name) => WIDTH_VARIANT.test(name))
    expect(guilty, "klasa przełącza postać pola zależnie od szerokości okna").toEqual([])
    view.unmount()
  })
})

describe("etykieta pola nie znika", () => {
  for (const locale of DESK_LOCALES) {
    it(`${locale}: stoi nad polem także wtedy, gdy człowiek już pisze`, () => {
      const translate = makeDeskT(locale)
      const empty = showField(locale, "")
      expect(within(empty.container).getByText(translate("case.placeholder"))).toBeInTheDocument()
      empty.unmount()

      const typed = showField(locale, "Policz koszty z faktur za sierpień")
      expect(within(typed.container).getByText(translate("case.placeholder"))).toBeInTheDocument()
      // Etykieta jest ZWIĄZANA z polem, a nie tylko postawiona obok: na tym stoi zarówno
      // czytnik ekranu, jak i wyszukiwanie pola po nazwie w testach z przeglądarki.
      expect(typed.getByLabelText(translate("case.placeholder"))).toHaveValue(
        "Policz koszty z faktur za sierpień",
      )
      typed.unmount()
    })
  }

  it("pole nie ma tekstu zastępczego — przykład stoi pod etykietą jako zdanie", () => {
    const translate = makeDeskT("pl")
    const view = showField("pl", "")
    const box = view.getByLabelText(translate("case.placeholder"))
    expect(box).not.toHaveAttribute("placeholder")
    expect(within(view.container).getByText(translate("case.example"))).toBeInTheDocument()
    view.unmount()
  })
})

describe("przycisk wysyłki niesie słowo, nie samą ikonę", () => {
  for (const locale of DESK_LOCALES) {
    it(`${locale}: na przycisku stoi zdanie ze słownika`, () => {
      const translate = makeDeskT(locale)
      const view = showField(locale, "Policz koszty")
      const send = within(view.container).getByRole("button", {
        name: translate("composer.send"),
      })
      const word = (send.textContent ?? "").trim()
      expect(word, "przycisk bez napisu").not.toBe("")
      // Sam klucz na przycisku znaczy brak wpisu w słowniku — `makeDeskT` oddaje wtedy klucz.
      expect(word).not.toMatch(/^[a-z]+(\.[A-Za-z]+)+$/)
      expect(word).toBe(translate("composer.send"))
      view.unmount()
    })
  }
})

describe("biurko i dół sprawy to jedno pole, nie dwie kopie", () => {
  it("oba ekrany sięgają po ten sam komponent i nie mają własnego pola", () => {
    for (const file of ["composer.tsx", "case-view.tsx"]) {
      const code = readFileSync(path.join(here, file), "utf8")
      expect(code, `${file}: pole zlecenia nie jest wspólnym komponentem`).toContain("<TaskField")
      expect(code, `${file}: własne pole tekstowe obok wspólnego`).not.toContain("<textarea")
    }
  })
})
