// @vitest-environment jsdom
//
// Defekt, który ten plik zamyka: pod Dominem paleta kolorów w formularzu
// Aplikacji zapisywała wartość i NIC nie zmieniała na hubie (D6 — wygląd ma
// trzy akcenty z kategorii funkcjonalnej, kolumny `applications.color` nie
// czyta), a formularz nie mówił o tym ani słowa. Alex ustawił
// `document-parser` na „emerald", zapis przeszedł, kafelek został taki sam.
import type { Application } from "@/features/system-config/types"
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Wiersz zdjęty z żywej bazy (`docker exec cortex-next-postgres psql -U cortex
// -d cortex`) — ten sam kafelek i ten sam kolor, na którym objaw zobaczył Alex.
const APPLICATION: Application = {
  id: "3f6f2f2e-0000-4000-8000-000000000001",
  code: "document-parser",
  name: "Parser Dokumentów",
  description: "Parser dokumentów",
  icon: "FileScan",
  kind: "native",
  route: "/document-parser",
  url: null,
  target: null,
  isActive: true,
  sortOrder: 0,
  showOnHub: true,
  color: "emerald",
  categoryFunctional: "content-generation",
  categoryDepartment: null,
  // Komplet tłumaczeń przywożony w wierszu katalogu — serwer nie rozstrzyga
  // nazwy, bo nie zna języka użytkownika (siedzi w `localStorage`).
  translations: { en: { name: "Document Parser", description: "Parses documents" } },
  activatedAt: "2026-08-05T09:00:00.000Z",
  createdAt: "2026-08-05T09:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z",
}

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: APPLICATION.code }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@cortex/api", () => ({ toastApiError: vi.fn() }))

// Wyniki zapytań są STAŁYMI, nie literałami tworzonymi przy każdym wywołaniu
// haka: strona synchronizuje stan formularza `useEffect`-em po `query.data`,
// więc świeża referencja co render zapętla ją w nieskończoność (render →
// setState → render). To jest własność mocka, nie strony.
const ROLES = { data: [], isLoading: false }
const APPLICATION_ROLES = { data: { roleIds: [] }, isLoading: false }
const SCOPES = { data: [], isLoading: false }
const SCOPE_GRANTS = { data: [], isLoading: false }
const APPLICATIONS = { data: [APPLICATION], isLoading: false }
const IDLE_MUTATION = { mutateAsync: vi.fn(), isPending: false }
/** Osobno od IDLE_MUTATION, bo na TĘ mutację asertujemy treść żądania —
 *  wspólny mock zbierałby wywołania z czterech niezależnych zapisów. */
const UPDATE_MUTATION = { mutateAsync: vi.fn().mockResolvedValue(APPLICATION), isPending: false }

vi.mock("@/features/system-config/hooks", () => ({
  useApplications: () => APPLICATIONS,
  useRoles: () => ROLES,
  useApplicationRoles: () => APPLICATION_ROLES,
  useApplicationScopes: () => SCOPES,
  useApplicationScopeGrants: () => SCOPE_GRANTS,
  useUpdateApplication: () => UPDATE_MUTATION,
  useDeleteApplication: () => IDLE_MUTATION,
  useSetApplicationRoles: () => IDLE_MUTATION,
  useSetApplicationScopeRoles: () => IDLE_MUTATION,
}))

const { InstancePresetProvider } = await import("@/lib/presets/instance-preset")
const { usePresetStore } = await import("@/lib/presets/preset-store")
const { useLocaleStore } = await import("@/lib/i18n/locale-store")
const { SOURCE_LOCALE } = await import("@/lib/i18n/config")
const { default: ApplicationDetailPage } = await import("./page")

/** Preset instancji, czyli ta sama droga, którą wygląd dociera do renderu w
 *  aplikacji (props z serwera) — nie skrót po samym store'rze użytkownika. */
function renderUnder(preset: string) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <InstancePresetProvider value={preset}>{children}</InstancePresetProvider>
  }
  return render(<ApplicationDetailPage />, { wrapper: Wrapper })
}

/** Zdanie o bezwładnej palecie. Regex, nie napis: etykieta wyglądu wchodzi w
 *  środek zdania z rejestru presetów, więc test nie może jej przepisywać. */
const INERT_COLOR_NOTICE = /Wygląd „.+” tej palety nie używa/

beforeEach(() => {
  localStorage.clear()
  usePresetStore.setState({ preset: null })
  UPDATE_MUTATION.mutateAsync.mockClear()
})

afterEach(() => {
  cleanup()
  // Język idzie PEŁNĄ ścieżką (`setLocale` przestawia też i18next), więc
  // trzeba go tą samą ścieżką cofnąć — inaczej wyciekłby na kolejne pliki.
  useLocaleStore.getState().setLocale(SOURCE_LOCALE)
})

describe("formularz Aplikacji: paleta kolorów a aktywny wygląd", () => {
  it("pod Dominem mówi wprost, że kolor nic tu nie zmienia", () => {
    renderUnder("domino")

    const notice = screen.getByText(INERT_COLOR_NOTICE)
    expect(notice).toBeInTheDocument()
    // Nazwa wyglądu z rejestru, nie ogólnikowe „ten wygląd" — admin ma wiedzieć,
    // czego dokładnie dotyczy zdanie, bo wygląd da się przełączyć z topbara.
    expect(notice).toHaveTextContent("Domino")
  })

  it("pod Neutralem i Customs nie ma o czym ostrzegać", () => {
    renderUnder("neutral")
    expect(screen.queryByText(INERT_COLOR_NOTICE)).toBeNull()
    cleanup()

    renderUnder("customs")
    expect(screen.queryByText(INERT_COLOR_NOTICE)).toBeNull()
  })

  // Ostrzeżenie idzie za AKTYWNYM wyglądem, a ten rozstrzyga się z dwóch źródeł
  // (wybór użytkownika bije preset instancji, `resolvePresetId`). Gdyby zdanie
  // czytało wyłącznie ustawienie instancji, admin z własnym Dominem widziałby
  // działającą paletę i wracał z tym samym zgłoszeniem.
  it("liczy się wygląd, który admin ma naprawdę włączony, a nie ustawienie instancji", () => {
    usePresetStore.setState({ preset: "domino" })
    renderUnder("neutral")
    expect(screen.getByText(INERT_COLOR_NOTICE)).toBeInTheDocument()
  })

  /**
   * Sedno kształtu tego rozwiązania: swatche zostają KLIKALNE. Kolor jest daną
   * instancji, nie ustawieniem podglądu edytującego — zapisuje się i maluje
   * kafelek każdemu, kto ma wygląd czytający paletę. `disabled` mówiłoby „nie
   * da się ustawić", czyli nieprawdę, i byłoby drugim kłamstwem w miejscu
   * pierwszego.
   */
  it("nie blokuje wyboru — wartość jest zapisywana i działa w innych wyglądach", () => {
    renderUnder("domino")

    const swatch = screen.getByRole("button", { name: "Szmaragdowy" })
    expect(swatch).toBeEnabled()
    expect(swatch).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText(INERT_COLOR_NOTICE)).toHaveTextContent(
      /zapisze się i zadziała w wyglądach, które paletę czytają/,
    )
  })

  it("podpowiedź o neutralnym kolorze domyślnym zostaje w każdym wyglądzie", () => {
    renderUnder("domino")
    expect(screen.getByText(/Kolor ikony kafelka na hubie/)).toBeInTheDocument()
  })
})

/**
 * Luka, którą te testy zamykają: angielskiej nazwy kafelka NIE DAŁO SIĘ zmienić
 * z panelu — siedziała w pliku `app/idp/locales/en/tiles.json`, a formularz
 * edytował wyłącznie kolumnę `applications.name`. Kafelek założony przez admina
 * pokazywał w angielskim interfejsie swoją polską nazwę.
 *
 * Model, o który prosił Alex: pole „Nazwa" pokazuje i zapisuje nazwę
 * w AKTUALNIE WYBRANYM języku, a obok stoi przycisk otwierający listę
 * wszystkich języków.
 */
function nameInput(): HTMLInputElement {
  return document.getElementById("name") as HTMLInputElement
}

function descriptionInput(): HTMLInputElement {
  return document.getElementById("description") as HTMLInputElement
}

/** Napis na przycisku zależy od języka, w którym akurat stoi test — stąd
 *  alternatywa, a nie jeden literał. */
function saveBasics(): void {
  fireEvent.click(screen.getByRole("button", { name: /Zapisz dane|Save details/ }))
}

/** Ciało ostatniego PATCH-a. Asercje idą po nim, a nie po ekranie, bo pytanie
 *  brzmi „która wartość poszła do bazy", a nie „co widać". */
function lastPatchBody(): {
  name: string
  description: string | null
  translations: Record<string, { name: string | null; description: string | null }>
} {
  const calls = UPDATE_MUTATION.mutateAsync.mock.calls
  return calls[calls.length - 1]?.[0]?.body
}

describe("pole „Nazwa” a aktualnie wybrany język", () => {
  it("po polsku pokazuje wartość bazową", () => {
    renderUnder("neutral")

    expect(nameInput().value).toBe("Parser Dokumentów")
    expect(descriptionInput().value).toBe("Parser dokumentów")
  })

  it("po angielsku pokazuje tłumaczenie, nie wartość bazową", () => {
    useLocaleStore.getState().setLocale("en")
    renderUnder("neutral")

    expect(nameInput().value).toBe("Document Parser")
    expect(descriptionInput().value).toBe("Parses documents")
  })

  it("po angielsku zapisuje do tłumaczenia i NIE rusza wartości bazowej", async () => {
    useLocaleStore.getState().setLocale("en")
    renderUnder("neutral")

    fireEvent.change(nameInput(), { target: { value: "Document Extractor" } })
    saveBasics()

    await waitFor(() => expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalled())
    const body = lastPatchBody()
    expect(body.name).toBe("Parser Dokumentów")
    expect(body.translations.en?.name).toBe("Document Extractor")
  })

  it("po polsku zapisuje wartość bazową i NIE rusza tłumaczenia", async () => {
    renderUnder("neutral")

    fireEvent.change(nameInput(), { target: { value: "Parser Faktur" } })
    saveBasics()

    await waitFor(() => expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalled())
    const body = lastPatchBody()
    expect(body.name).toBe("Parser Faktur")
    expect(body.translations.en?.name).toBe("Document Parser")
  })

  /**
   * Trasa ODRZUCA klucz `pl` błędem 400 (`BASE_VALUE_LOCALE` w @cortex/service):
   * wiersz tłumaczenia w języku wartości bazowych wygrywałby z kolumną
   * `applications.name`, czyli chowałby nazwę wpisaną przez admina pod
   * wartością, której panel nie pokazuje — dokładnie ten defekt, dla którego
   * powstała ta tabela. Formularz nie ma prawa takiego klucza wyprodukować.
   */
  it("nigdy nie wysyła tłumaczenia w języku wartości bazowych", async () => {
    useLocaleStore.getState().setLocale("en")
    renderUnder("neutral")

    fireEvent.change(nameInput(), { target: { value: "Document Extractor" } })
    saveBasics()

    await waitFor(() => expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalled())
    expect(Object.keys(lastPatchBody().translations)).not.toContain(SOURCE_LOCALE)
  })

  /** Bez tego zdania admin w angielskim interfejsie nie wie, czy zmienia nazwę
   *  angielską, czy bazową — a różnica widoczna jest dopiero po przełączeniu
   *  języka. */
  it("podpowiedź mówi, w jakim języku edytuje się pole", () => {
    renderUnder("neutral")
    expect(screen.getAllByText(/Edytujesz wartość bazową \(Polski\)/).length).toBeGreaterThan(0)

    cleanup()
    useLocaleStore.getState().setLocale("en")
    renderUnder("neutral")
    expect(screen.getAllByText(/You are editing the English translation/).length).toBeGreaterThan(
      0,
    )
  })
})

describe("okno „Tłumaczenia”", () => {
  function openTranslations(): void {
    fireEvent.click(screen.getByRole("button", { name: "Tłumaczenia" }))
  }

  /** Okno jest modalne (Radix chowa resztę strony przed czytnikiem ekranu),
   *  więc „Zapisz dane" jest osiągalne dopiero po jego zamknięciu — i tak samo
   *  wygląda to u admina. */
  function closeTranslations(): void {
    fireEvent.click(screen.getByRole("button", { name: "Gotowe" }))
  }

  function localeInput(locale: string, field: "name" | "description"): HTMLInputElement {
    return document.getElementById(`translation-${field}-${locale}`) as HTMLInputElement
  }

  it("pokazuje WSZYSTKIE języki, po dwa pola na język", () => {
    renderUnder("neutral")
    openTranslations()

    for (const locale of ["pl", "en"]) {
      expect(localeInput(locale, "name")).toBeInTheDocument()
      expect(localeInput(locale, "description")).toBeInTheDocument()
    }
  })

  /**
   * Wiersz języka źródłowego jest ZWIĄZANY z tą samą wartością co pole „Nazwa"
   * wyżej, a nie jej kopią. Osobna kopia dałaby dwa źródła prawdy dla jednej
   * nazwy i użytkownik nie wiedziałby, które wygrywa.
   */
  it("wiersz języka źródłowego to ta sama wartość co pole „Nazwa” wyżej", () => {
    renderUnder("neutral")
    openTranslations()

    expect(localeInput("pl", "name").value).toBe("Parser Dokumentów")

    fireEvent.change(localeInput("pl", "name"), { target: { value: "Parser Faktur" } })
    expect(nameInput().value).toBe("Parser Faktur")

    fireEvent.change(nameInput(), { target: { value: "Parser Umów" } })
    expect(localeInput("pl", "name").value).toBe("Parser Umów")
  })

  it("oznacza wiersz języka źródłowego jako wartość bazową, nie jako tłumaczenie", () => {
    renderUnder("neutral")
    openTranslations()

    expect(screen.getByText("wartość bazowa")).toBeInTheDocument()
    expect(screen.getByText("tłumaczenie")).toBeInTheDocument()
  })

  /**
   * Wyczyszczenie pola KASUJE tłumaczenie (kafelek wraca na wartość bazową),
   * a nie zapisuje pusty napis. Serwis kasuje wiersz, w którym po scaleniu nie
   * zostaje ani jedna wartość — ale tylko wtedy, gdy klucz w ogóle przyjdzie:
   * pominięcie go znaczy „zostaw bez zmian", więc skasowanego tłumaczenia nie
   * dałoby się skasować.
   */
  it("wyczyszczone pole jedzie jako `null`, a nie pusty napis ani brak klucza", async () => {
    renderUnder("neutral")
    openTranslations()

    fireEvent.change(localeInput("en", "name"), { target: { value: "" } })
    fireEvent.change(localeInput("en", "description"), { target: { value: "   " } })
    closeTranslations()
    saveBasics()

    await waitFor(() => expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalled())
    const { translations } = lastPatchBody()
    expect(translations).toHaveProperty("en")
    expect(translations.en).toEqual({ name: null, description: null })
  })

  /** Oba pola są osobno nullowalne: wolno skasować sam opis i zostawić nazwę. */
  it("kasuje pojedyncze pole, nie cały wpis języka", async () => {
    renderUnder("neutral")
    openTranslations()

    fireEvent.change(localeInput("en", "description"), { target: { value: "" } })
    closeTranslations()
    saveBasics()

    await waitFor(() => expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalled())
    expect(lastPatchBody().translations.en).toEqual({
      name: "Document Parser",
      description: null,
    })
  })
})
