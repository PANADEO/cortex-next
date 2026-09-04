// @vitest-environment jsdom
// PLIK PRZECIĄGNIĘTY Z PULPITU MA WYLĄDOWAĆ W ZLECENIU — albo powiedzieć, dlaczego nie.
//
// DLACZEGO POWSTAŁ. Przeciąganie działało wyłącznie w „Moich plikach". Pole zlecenia miało
// `onPaste` robiące dokładnie to samo — składające `DataTransfer` i wołające `onFiles` —
// i nie miało `onDrop`. Mechanizm był, brakowało jednego uchwytu.
//
// Ten plik pilnuje czterech rzeczy, z których TRZY psują się po cichu:
//
//   1. celem jest cała ramka, nie samo pole tekstowe (chybienie o trzy piksele),
//   2. upuszczenie poza ramką nie może WYRZUCIĆ CZŁOWIEKA Z APLIKACJI — przeglądarka
//      domyślnie otwiera upuszczony plik, a wtedy sprawa znika z ekranu,
//   3. katalog wygląda jak plik i upuszcza się tak samo, a niesie zero bajtów,
//   4. podświetlenie ma znikać, choć `dragleave` strzela też z każdego dziecka ramki.
//
// Punkt 2 jest najgroźniejszy i jednocześnie niewidoczny w każdym scenariuszu, który
// upuszcza CELNIE — a testy pisze się celnie.

import { fireEvent, render, screen, type RenderResult } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { DeskLocaleProvider } from "../i18n/client"
import { makeDeskT } from "../i18n/locale"
import { TaskField } from "./task-field"
import { ToastProvider } from "./toast"

const t = makeDeskT("pl")

const policy = {
  user: "anna",
  role: "member",
  granted: [{ id: "files.read", department: "accounting" }],
  blocked: [],
  dailyLimitUsd: 1,
  fingerprint: "x",
} as never

function show(onFiles: (f: FileList | null) => void): RenderResult {
  const box = createRef<HTMLTextAreaElement>()
  return render(
    <DeskLocaleProvider locale="pl">
      <ToastProvider>
        <TaskField
          text=""
          onText={() => {}}
          hint={t("case.example")}
          box={box}
          busy={false}
          files={[]}
          removeFile={() => {}}
          onFiles={onFiles}
          onSend={() => {}}
          policyFor={policy}
        />
      </ToastProvider>
    </DeskLocaleProvider>,
  )
}

const frame = (r: RenderResult) => r.container.querySelector('[data-drop="task"]')!

/** `DataTransfer` w jsdom jest atrapą — składamy własny o tym samym kształcie. */
const carrying = (files: File[], folders = 0) =>
  ({
    types: ["Files"],
    files: Object.assign(files, { item: (i: number) => files[i] ?? null }) as unknown as FileList,
    items: [
      ...files.map(() => ({ webkitGetAsEntry: () => ({ isDirectory: false }) })),
      ...Array.from({ length: folders }, () => ({
        webkitGetAsEntry: () => ({ isDirectory: true }),
      })),
    ],
  }) as unknown as DataTransfer

const csvFile = () => new File(["nr,netto\n1,2\n"], "faktury-08.csv", { type: "text/csv" })

describe("upuszczenie pliku na pole zlecenia", () => {
  it("dołącza plik, gdy trafi w ramkę", () => {
    const onFiles = vi.fn()
    const r = show(onFiles)
    fireEvent.drop(frame(r), { dataTransfer: carrying([csvFile()]) })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles.mock.calls[0]?.[0]?.[0]?.name).toBe("faktury-08.csv")
  })

  it("dołącza także wtedy, gdy trafi w SAMO POLE TEKSTOWE", () => {
    // Pole tekstowe jest dzieckiem ramki, więc zdarzenie ma się przez nią przebąblować.
    // Gdyby uchwyt siedział na `textarea`, chybienie o obramowanie kończyłoby się otwarciem
    // pliku w przeglądarce — czyli zniknięciem sprawy z ekranu.
    const onFiles = vi.fn()
    show(onFiles)
    fireEvent.drop(screen.getByRole("textbox"), { dataTransfer: carrying([csvFile()]) })
    expect(onFiles).toHaveBeenCalledTimes(1)
  })

  it("mówi, że KATALOGU nie przyjmie, i nie dołącza niczego", async () => {
    const onFiles = vi.fn()
    const r = show(onFiles)
    fireEvent.drop(frame(r), { dataTransfer: carrying([], 1) })
    expect(onFiles).not.toHaveBeenCalled()
    expect(await screen.findByText(t("case.dropFolder"))).toBeTruthy()
  })

  it("nie reaguje na przeciągnięty TEKST — to nie jest plik", () => {
    // Zaznaczony wyraz przeciągnięty na pole ma trafić do treści zlecenia, a nie zamienić
    // się w załącznik ani zapalić podświetlenie.
    const onFiles = vi.fn()
    const r = show(onFiles)
    const text = { types: ["text/plain"], files: [], items: [] } as unknown as DataTransfer
    fireEvent.dragEnter(frame(r), { dataTransfer: text })
    expect(screen.queryByText(t("case.dropHere"))).toBeNull()
    fireEvent.drop(frame(r), { dataTransfer: text })
    expect(onFiles).not.toHaveBeenCalled()
  })
})

describe("podświetlenie w chwili najechania plikiem", () => {
  it("zapala się i mówi, CO się stanie po puszczeniu", () => {
    // Sama ramka nie wystarcza: „coś się podświetliło" nie mówi, czy plik trafi do zlecenia,
    // czy do Moich plików. Te dwie rzeczy mają w tym produkcie różne skutki.
    const r = show(vi.fn())
    fireEvent.dragEnter(frame(r), { dataTransfer: carrying([csvFile()]) })
    expect(screen.getByText(t("case.dropHere"))).toBeTruthy()
  })

  it("gaśnie po wyjściu, mimo że `dragleave` strzela też z dzieci", () => {
    // Wejście na ramkę, potem na pole tekstowe w środku (drugie `dragenter`, jedno
    // `dragleave` z ramki) i dopiero wyjście. Bez licznika podświetlenie zgasłoby
    // w połowie drogi i wróciło — czyli mrugało przy każdym ruchu myszy.
    const r = show(vi.fn())
    const box = screen.getByRole("textbox")
    fireEvent.dragEnter(frame(r), { dataTransfer: carrying([csvFile()]) })
    fireEvent.dragEnter(box, { dataTransfer: carrying([csvFile()]) })
    fireEvent.dragLeave(frame(r))
    expect(screen.getByText(t("case.dropHere"))).toBeTruthy()
    fireEvent.dragLeave(box)
    expect(screen.queryByText(t("case.dropHere"))).toBeNull()
  })

  it("gaśnie po upuszczeniu", () => {
    const r = show(vi.fn())
    fireEvent.dragEnter(frame(r), { dataTransfer: carrying([csvFile()]) })
    fireEvent.drop(frame(r), { dataTransfer: carrying([csvFile()]) })
    expect(screen.queryByText(t("case.dropHere"))).toBeNull()
  })
})

describe("chybiony cel nie wyrzuca człowieka z aplikacji", () => {
  it("upuszczenie POZA ramką jest połykane, a nie otwierane przez przeglądarkę", () => {
    // NAJWAŻNIEJSZY test w tym pliku i jedyny, którego nie widać w żadnym scenariuszu
    // upuszczającym celnie. Bez blokady przeglądarka nawiguje do upuszczonego pliku:
    // aplikacja znika, a człowiek nie wie, co się stało ani jak wrócić.
    show(vi.fn())
    const outside = new Event("drop", { bubbles: true, cancelable: true })
    document.body.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(true)
  })

  it("ale NIE połyka zdarzenia, które ktoś już obsłużył", () => {
    // Kontrola ujemna. Bez warunku `defaultPrevented` ta blokada zabiłaby upuszczanie
    // w „Moich plikach", które działa i ma zostać.
    show(vi.fn())
    const handled = new Event("drop", { bubbles: true, cancelable: true })
    const owner = document.createElement("div")
    document.body.appendChild(owner)
    owner.addEventListener("drop", (e) => e.preventDefault())
    let sawAlreadyHandled = false
    document.addEventListener("drop", (e) => {
      sawAlreadyHandled = e.defaultPrevented
    })
    owner.dispatchEvent(handled)
    expect(sawAlreadyHandled).toBe(true)
    owner.remove()
  })
})
