// @vitest-environment jsdom
//
// Defekt, który ten plik zamyka: pod Dominem paleta kolorów w formularzu
// Aplikacji zapisywała wartość i NIC nie zmieniała na hubie (D6 — wygląd ma
// trzy akcenty z kategorii funkcjonalnej, kolumny `applications.color` nie
// czyta), a formularz nie mówił o tym ani słowa. Alex ustawił
// `document-parser` na „emerald", zapis przeszedł, kafelek został taki sam.
import type { Application } from "@/features/system-config/types"
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
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

vi.mock("@/features/system-config/hooks", () => ({
  useApplications: () => APPLICATIONS,
  useRoles: () => ROLES,
  useApplicationRoles: () => APPLICATION_ROLES,
  useApplicationScopes: () => SCOPES,
  useApplicationScopeGrants: () => SCOPE_GRANTS,
  useUpdateApplication: () => IDLE_MUTATION,
  useDeleteApplication: () => IDLE_MUTATION,
  useSetApplicationRoles: () => IDLE_MUTATION,
  useSetApplicationScopeRoles: () => IDLE_MUTATION,
}))

const { InstancePresetProvider } = await import("@/lib/presets/instance-preset")
const { usePresetStore } = await import("@/lib/presets/preset-store")
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
})

afterEach(cleanup)

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
