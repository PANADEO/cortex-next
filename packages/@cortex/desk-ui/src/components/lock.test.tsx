// @vitest-environment jsdom
//
// KARTA ODMOWY ZAWSZE MA WYJŚCIE — i to jest jedyna rzecz, której ten plik pilnuje.
//
// DLACZEGO POWSTAŁ. Cały przycisk pod kłódką wisiał na `capabilityId`. Zdarzenie
// `blocked` niesie go tylko wtedy, gdy opis odmowy trafił w kurowany, krótki katalog
// zdolności — a kiedy nie trafił, karta kończyła się zdaniem „Tego nie umiem zrobić
// przy Twoich uprawnieniach" i pustką pod spodem. Pani Basia dostawała ścianę bez klamki
// dokładnie w chwili, w której najbardziej potrzebowała wiedzieć, co dalej.
//
// CZEGO PILNUJE, w kolejności ważności:
//   1. dopóki człowiek nie poprosił, na karcie STOI przycisk — w każdym wariancie
//      danych, jakie niesie zdarzenie, i w obu językach;
//   2. napis na przycisku jedzie ze słownika, a nie z komponentu (dowód: zmienia się
//      z językiem i nie jest samym kluczem);
//   3. karta mówi, KTO wydaje zgodę — z imienia, gdy Biurko je zna, a bezimiennie,
//      gdy nie zna; nigdy przez dział, do którego nie da się podejść i zapytać.

import "@testing-library/jest-dom/vitest"
import { render, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DeskLocaleProvider } from "../i18n/client"
import { DESK_LOCALES, makeDeskT, type DeskLocale } from "../i18n/locale"
import { CapabilityLock } from "./lock"

type LockProps = Parameters<typeof CapabilityLock>[0]

const show = (locale: DeskLocale, props: LockProps) =>
  render(
    <DeskLocaleProvider locale={locale}>
      <CapabilityLock {...props} />
    </DeskLocaleProvider>,
  )

/** Wszystkie kształty, w jakich zdarzenie `blocked` naprawdę dociera do ekranu. */
const SHAPES: { what: string; props: LockProps }[] = [
  {
    what: "zdolność z katalogu",
    props: { description: "zapisać zestawienie jako arkusz", capabilityId: "sheet.write" },
  },
  {
    what: "opis, który w katalog nie trafił",
    props: { description: "zapisać zestawienie jako arkusz" },
  },
  {
    what: "stare zdarzenie, które niesie samą nazwę",
    props: { description: "zapisać zestawienie jako arkusz", name: "Tworzenie arkuszy" },
  },
]

const APPROVERS = [
  { what: "przełożony znany z imienia", approver: "Robert Nowak" },
  { what: "przełożonego nie da się wskazać", approver: "" },
]

describe("karta odmowy zawsze kończy się czynnością", () => {
  for (const locale of DESK_LOCALES) {
    for (const shape of SHAPES) {
      for (const boss of APPROVERS) {
        it(`${locale}: ${shape.what}, ${boss.what} — jest co kliknąć`, () => {
          const translate = makeDeskT(locale)
          const view = show(locale, { ...shape.props, approver: boss.approver })
          const buttons = within(view.container).getAllByRole("button")

          expect(buttons.length, "karta odmowy bez żadnej czynności").toBeGreaterThan(0)
          const text = (buttons[0]?.textContent ?? "").trim()
          expect(text, "przycisk bez napisu").not.toBe("")
          // Sam klucz na przycisku znaczy brak wpisu w słowniku — `makeDeskT` oddaje
          // wtedy klucz, a na ekranie stoi `lock.askForApproval` zamiast czasownika.
          expect(text).not.toMatch(/^[a-z]+(\.[A-Za-z]+)+$/)
          expect([
            translate("lock.askForApproval"),
            translate("lock.writeWhatYouNeed"),
          ]).toContain(text)
          view.unmount()
        })
      }
    }
  }

  it("napis na przycisku jedzie ze słownika, a nie z komponentu", () => {
    const pl = show("pl", { description: "zapisać jako arkusz" })
    const inPolish = within(pl.container).getAllByRole("button")[0]?.textContent
    pl.unmount()
    const en = show("en", { description: "zapisać jako arkusz" })
    const inEnglish = within(en.container).getAllByRole("button")[0]?.textContent
    en.unmount()

    expect(inPolish).toBe(makeDeskT("pl")("lock.writeWhatYouNeed"))
    expect(inEnglish).toBe(makeDeskT("en")("lock.writeWhatYouNeed"))
    expect(inPolish).not.toBe(inEnglish)
  })
})

describe("karta odmowy mówi, kto wydaje zgodę", () => {
  it("z imienia, gdy Biurko zna tę osobę", () => {
    const view = show("pl", {
      description: "zapisać jako arkusz",
      capabilityId: "sheet.write",
      approver: "Robert Nowak",
    })
    expect(view.container.textContent).toContain("Robert Nowak")
    expect(view.container.textContent).toContain(
      makeDeskT("pl")("lock.decidedBy", { person: "Robert Nowak" }),
    )
    view.unmount()
  })

  it("bezimiennie, gdy nie zna — ale nigdy przez dział", () => {
    // Dział jest bytem, do którego nie da się podejść i zapytać. Zdanie zapasowe mówi
    // przynajmniej o człowieku, a przycisk działa tak samo: prośba trafia do kolejki.
    const view = show("pl", { description: "zapisać jako arkusz", capabilityId: "sheet.write" })
    expect(view.container.textContent).toContain(makeDeskT("pl")("lock.decidedByAnyone"))
    expect(view.container.textContent?.toLowerCase()).not.toContain("dział")
    view.unmount()
  })

  it("gdy prośba już poszła, karta mówi, na co czeka, i wciąż niesie imię", () => {
    // To jedyny stan bez przycisku i jedyny, w którym wolno mu go nie mieć: człowiek
    // już wykonał ruch. Karta ma wtedy powiedzieć, na co czeka i u kogo.
    const view = show("pl", {
      description: "zapisać jako arkusz",
      capabilityId: "sheet.write",
      alreadyRequested: true,
      approver: "Robert Nowak",
    })
    expect(view.container.textContent).toContain(makeDeskT("pl")("capabilities.requestSent"))
    expect(view.container.textContent).toContain("Robert Nowak")
    view.unmount()
  })
})
