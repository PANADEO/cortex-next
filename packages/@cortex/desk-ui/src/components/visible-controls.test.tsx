// @vitest-environment jsdom
//
// IKONA BEZ PODPISU NIE ISTNIEJE, A RZECZ SCHOWANA POD MYSZĄ NIE ISTNIEJE TYM BARDZIEJ.
//
// DLACZEGO POWSTAŁ. Kanon tego produktu każe wskazać palcem każdy element i powiedzieć,
// gdzie pani Basia widziała go wcześniej. Trzy miejsca odpowiadały „nigdzie":
//   · panel wyniku miał trzy GOŁE IKONY (pobierz, zapisz, kopiuj) z samym `aria-label` —
//     czytnik ekranu je nazywał, wzrok nie;
//   · wiersz pliku chował trzy kropki i pole wyboru pod `opacity-0 group-hover:opacity-100`,
//     czyli oddawał je wyłącznie temu, kto już wiedział, że tam są;
//   · kafel załącznika chował tak samo krzyżyk, który cofa pomyłkę.
// Obrona „ma `aria-label`, więc jest podpisane" nie przechodzi: czytnik ekranu to nie
// jest to samo co wzrok, a dymek trzeba najpierw wywołać myszą, której na telefonie nie ma.
//
// CZEGO PILNUJE:
//   1. w żadnym z tych komponentów nie ma klikalnego elementu, który wychodzi z ukrycia
//      dopiero pod myszą (`opacity-0` + wariant `hover:` przywracający widoczność);
//   2. listwa panelu wyniku niesie trzy SŁOWA ze słownika, w obu językach;
//   3. listwa nad polem zlecenia ma jedną, przewidywalną kolejność — i jest to ta sama
//      listwa na biurku i na dole sprawy, bo to jeden komponent.
//
// CZEGO NIE ŁAPIE, powiedziane wprost, żeby nikt nie brał go za szczelny:
//   · układu liczonego przez przeglądarkę. jsdom nie stosuje arkusza Tailwinda i nie mierzy
//     pikseli, więc widoczność sprawdzamy na ŹRÓDLE, a nie na wyliczonym stylu — a `opacity-0`
//     zostawia element w DOM, o pełnym rozmiarze, więc żadne `toBeVisible` go nie odróżni.
//     Ten drugi pomiar robi Playwright w `apps/desk/e2e/19-audyt-ux.spec.ts`, obszar 28d;
//   · klasy skleconej POZA napisem dosłownym — z tablicy, ze zmiennej, z `clsx`. Czytamy
//     literały z pliku, bo tak te komponenty są napisane; klasa złożona gdzie indziej
//     przejdzie bokiem. Zabezpieczeniem jest wtedy wyłącznie scenariusz w przeglądarce.

import type { Evidence } from "@cortex/desk-core/evidence"
import type { FileMeta, Policy } from "@cortex/desk-core/types"
import "@testing-library/jest-dom/vitest"
import { render, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRef } from "react"
import { describe, expect, it } from "vitest"
import { DeskLocaleProvider } from "../i18n/client"
import { DESK_LOCALES, makeDeskT, type DeskLocale } from "../i18n/locale"
import { ResultPanel } from "./result-panel"
import { TaskField } from "./task-field"
import { ToastProvider } from "./toast"

const here = path.dirname(fileURLToPath(import.meta.url))

/** Komponenty, w których człowiek sięga po czynności na plikach i na zleceniu. */
const WATCHED = [
  "composer.tsx",
  "task-field.tsx",
  "result-panel.tsx",
  "file-row.tsx",
  "attachments.tsx",
  "capability-list.tsx",
  "preview.tsx",
]

/**
 * Czy ten człon klasy PRZYWRACA widoczność pod myszą. Wariant nazywa się `hover:`,
 * `group-hover:` albo `group-hover/nazwa:` i ustawia `opacity-` na wartość niezerową.
 *
 * `[@media(hover:none)]:opacity-100` NIE jest takim członem, choć zawiera słowo „hover":
 * to pytanie o RODZAJ wskaźnika (ekran dotykowy), a nie o to, gdzie stoi kursor —
 * i właśnie dlatego rozstrzygamy po całym członie, a nie szukaniem podnapisu.
 */
const revealsOnHover = (piece: string) => /^(?:group-)?hover(?:\/[\w-]+)?:opacity-[1-9]/.test(piece)

/** Czy ten napis z klasami chowa coś, co wraca dopiero pod myszą. */
export function hidesUntilHover(classes: string): boolean {
  const pieces = classes.split(/\s+/).filter(Boolean)
  return pieces.includes("opacity-0") && pieces.some(revealsOnHover)
}

/** Wszystkie napisy dosłowne z pliku — także te sklejane w szablonie klas. */
function literalsIn(file: string): string[] {
  const code = readFileSync(path.join(here, file), "utf8")
  return [...code.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? "")
}

describe("nic klikalnego nie czeka na mysz", () => {
  it("żaden z komponentów czynności nie chowa elementu pod `opacity-0` z powrotem na `hover`", () => {
    const offenders = WATCHED.flatMap((file) =>
      literalsIn(file)
        .filter(hidesUntilHover)
        .map((classes) => `${file}: ${classes}`),
    )
    expect(
      offenders,
      "element wychodzi z ukrycia dopiero pod myszą — dla kogoś, kto o nim nie wie, nie istnieje",
    ).toEqual([])
  })

  it("reguła zapala się na naruszeniu i milczy na treści niewinnej", () => {
    // KONTROLA DODATNIA — dokładnie to, co stało w `file-row.tsx` i `attachments.tsx`.
    expect(hidesUntilHover("opacity-0 group-hover:opacity-100")).toBe(true)
    expect(hidesUntilHover("opacity-0 shadow-desk-pop group-hover/chip:opacity-100")).toBe(true)

    // KONTROLA UJEMNA — strażnik, który myli się przeciwko dobremu kodowi, uczy go omijać.
    // Podświetlenie tła pod myszą jest w porządku: element JEST widoczny bez niej.
    expect(hidesUntilHover("rounded-sm text-desk-muted hover:bg-desk-raised")).toBe(false)
    // Sam `focus-visible` przywraca widoczność klawiaturze, nie myszy — ale bez wariantu
    // `hover:` i tak nie ma tu czego zapalać.
    expect(hidesUntilHover("opacity-0 focus-visible:opacity-100")).toBe(false)
    // Pytanie o rodzaj wskaźnika zawiera słowo „hover" i nie ma z tą regułą nic wspólnego.
    expect(hidesUntilHover("opacity-0 [@media(hover:none)]:opacity-100")).toBe(false)
    // Chowanie POD myszą to nie to samo co odsłanianie: `group-hover:opacity-0` ustępuje
    // miejsca czemuś innemu i nie ukrywa niczego, co ma być klikalne.
    expect(hidesUntilHover("group-hover:opacity-0")).toBe(false)
  })
})

const policy: Policy = {
  user: "anna",
  role: "member",
  granted: [],
  blocked: [],
  dailyLimitUsd: 5,
  fingerprint: "test",
}

/**
 * Wynik pracy w postaci, w jakiej panel go dostaje. `.png` świadomie — podgląd obrazu
 * rysuje `<img>`, więc nie sięga po `fetch`, którego w jsdom nie ma.
 */
const RESULT: FileMeta = {
  name: "zestawienie.png",
  path: "Sprawy/x/zestawienie.png",
  folder: false,
  size: 2048,
  modifiedAt: "2026-09-03T10:00:00.000Z",
}

const NO_EVIDENCE: Evidence = {
  intake: [],
  produced: [],
  // `external` i `notAllowed` NIE SĄ opcjonalne — pominięte, dawały błąd typu, którego
  // `tsc -p apps/desk` nie widzi, bo ten projekt nie obejmuje testów tego pakietu.
  external: [],
  unverified: [],
  notAllowed: [],
  files: { saved: [], verified: [] },
}

function showPanel(locale: DeskLocale) {
  return render(
    <DeskLocaleProvider locale={locale}>
      <ToastProvider>
        <ResultPanel
          results={[RESULT]}
          attachments={[]}
          active={RESULT}
          onPick={() => {}}
          evidence={NO_EVIDENCE}
        />
      </ToastProvider>
    </DeskLocaleProvider>,
  )
}

describe("listwa panelu wyniku niesie słowa, nie same ikony", () => {
  for (const locale of DESK_LOCALES) {
    it(`${locale}: pobranie, zapisanie i skopiowanie mają widoczny podpis`, () => {
      const translate = makeDeskT(locale)
      const view = showPanel(locale)
      for (const key of ["files.download", "result.save", "result.copy"] as const) {
        const word = translate(key)
        const button = within(view.container).getByRole("button", { name: word })
        // Napis ma być WIDOCZNY, nie tylko wpisany w `aria-label`: to jest cała różnica
        // między „czytnik ekranu wie" a „człowiek widzi".
        expect((button.textContent ?? "").trim(), `${key}: przycisk bez napisu`).toBe(word)
      }
      view.unmount()
    })
  }
})

describe("listwa nad polem zlecenia ma jedną kolejność", () => {
  it("dodanie pliku, zdolności i wysyłka stoją zawsze w tym samym porządku", () => {
    // Kolejność jest treścią, nie estetyką: pani Basia wraca do tego ekranu jak do szuflady
    // i sięga w to samo miejsce. Ta sama listwa stoi na biurku i na dole sprawy, bo oba
    // ekrany rysują TEN SAM komponent — pilnuje tego `task-field.test.tsx`.
    const translate = makeDeskT("pl")
    const box = createRef<HTMLTextAreaElement>()
    const view = render(
      <DeskLocaleProvider locale="pl">
        <TaskField
          text="Policz koszty"
          onText={() => {}}
          hint={translate("case.example")}
          box={box}
          busy={false}
          files={[]}
          removeFile={() => {}}
          onFiles={() => {}}
          onSend={() => {}}
          policyFor={policy}
        />
      </DeskLocaleProvider>,
    )
    const wanted = [
      translate("case.addFile"),
      translate("capabilities.canDoHere", { count: 0 }),
      translate("composer.send"),
    ]
    const shown = [...view.container.querySelectorAll("button")]
      .map((b) => (b.textContent ?? "").trim())
      .filter((word) => wanted.includes(word))
    expect(shown, "listwa nad polem zlecenia zmieniła kolejność albo zgubiła pozycję").toEqual(
      wanted,
    )
    view.unmount()
  })
})
