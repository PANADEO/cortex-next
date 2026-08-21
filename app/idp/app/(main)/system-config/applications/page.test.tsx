// @vitest-environment jsdom
//
// Rozstrzygnięcie 1 z PROJECT/cortex-frontend/ARTIFACTS/i18n/
// cortex-frontend-tlumaczenia-nazw-kafelkow-projekt.md: przy TWORZENIU kafelka
// pole „Nazwa" zapisuje ZAWSZE wartość bazową, niezależnie od języka
// interfejsu.
//
// Powód jest twardy: `applications.name` jest NOT NULL, więc każdy nowy wiersz
// musi mieć wartość bazową. Admin pracujący po angielsku wpisze nazwę
// angielską i ona wyląduje w kolumnie opisanej jako „wartość bazowa" — i to
// jest w porządku, bo ta kolumna jest ZAPASEM, a nie „polską nazwą".
// Alternatywa (wymuszanie polskiej nazwy w angielskim interfejsie) jest gorsza:
// admin nie musi znać polskiego.
//
// Okno „Tłumaczenia" jest dostępne dopiero w szczegółach, po zapisaniu — bez
// wiersza w bazie nie ma czego tłumaczyć.
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@cortex/api", () => ({ toastApiError: vi.fn() }))

// Stałe, nie literały tworzone przy każdym wywołaniu haka — patrz komentarz
// przy tych samych mockach w `[code]/page.test.tsx`.
const APPLICATIONS = { data: [], isLoading: false }
const UNACTIVATED = { data: [], isLoading: false }
const IDLE_MUTATION = { mutateAsync: vi.fn(), isPending: false }
const CREATE_MUTATION = {
  mutateAsync: vi.fn().mockResolvedValue({ code: "czat-zewnetrzny", name: "External Chat" }),
  isPending: false,
}

vi.mock("@/features/system-config/hooks", () => ({
  useApplications: () => APPLICATIONS,
  useUnactivatedNativeApplications: () => UNACTIVATED,
  useCreateApplication: () => CREATE_MUTATION,
  useUpdateApplication: () => IDLE_MUTATION,
  useActivateApplication: () => IDLE_MUTATION,
}))

const { useLocaleStore } = await import("@/lib/i18n/locale-store")
const { SOURCE_LOCALE } = await import("@/lib/i18n/config")
const { default: ApplicationsPage } = await import("./page")

beforeAll(() => {
  // Radix Select potrzebuje API wskaźnika, którego jsdom nie ma — ten sam
  // zestaw zaślepek co w `intrastat/upload-batch-button.test.tsx`.
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  })
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  })
})

beforeEach(() => {
  localStorage.clear()
  CREATE_MUTATION.mutateAsync.mockClear()
})

afterEach(cleanup)

afterAll(() => {
  useLocaleStore.getState().setLocale(SOURCE_LOCALE)
})

/** Okno nowej aplikacji, przełączone na kafelek typu „link zewnętrzny" —
 *  jedyną ścieżkę, na której admin w ogóle wpisuje nazwę ręcznie (kafelek
 *  natywny bierze ją z manifestu). */
async function openCreateExternal(kindLabel: string, optionLabel: string) {
  const user = userEvent.setup()
  render(<ApplicationsPage />)
  // Pusty katalog pokazuje ten sam przycisk dwa razy (nagłówek + stan pusty)
  // — bierzemy ten z nagłówka, jak admin.
  const [addButton] = screen.getAllByRole("button", { name: /Dodaj aplikację|Add application/ })
  await user.click(addButton as HTMLElement)
  await user.click(screen.getByLabelText(kindLabel))
  await user.click(await screen.findByRole("option", { name: optionLabel }))
  return user
}

describe("tworzenie kafelka w interfejsie angielskim", () => {
  it("pole „Nazwa” zapisuje wartość bazową, a nie tłumaczenie", async () => {
    useLocaleStore.getState().setLocale("en")
    const user = await openCreateExternal("Type", "External link (new tab)")

    await user.type(screen.getByLabelText("Entitlement code"), "czat-zewnetrzny")
    await user.type(screen.getByLabelText("Name"), "External Chat")
    await user.type(screen.getByLabelText("External address"), "https://chat.example.com")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(CREATE_MUTATION.mutateAsync).toHaveBeenCalledTimes(1)
    const body = CREATE_MUTATION.mutateAsync.mock.calls[0]?.[0]
    expect(body.name).toBe("External Chat")
    // Kolumna, nie mapa: POST nie przyjmuje tłumaczeń w ogóle (okno otwiera się
    // dopiero po zapisaniu), więc klucz `translations` nie ma prawa tu być.
    expect(body).not.toHaveProperty("translations")
  })

  it("mówi wprost, że to wartość bazowa, i gdzie ustawia się tłumaczenia", async () => {
    useLocaleStore.getState().setLocale("en")
    await openCreateExternal("Type", "External link (new tab)")

    expect(
      screen.getByText(/Saved as the base value, whatever the interface language/),
    ).toBeInTheDocument()
  })

  it("po polsku zachowuje się identycznie — jedna kolumna, jedna ścieżka", async () => {
    useLocaleStore.getState().setLocale(SOURCE_LOCALE)
    const user = await openCreateExternal("Typ", "Link zewnętrzny (nowa karta)")

    await user.type(screen.getByLabelText("Kod uprawnienia"), "czat-zewnetrzny")
    await user.type(screen.getByLabelText("Nazwa"), "Czat zewnętrzny")
    await user.type(screen.getByLabelText("Adres zewnętrzny"), "https://chat.example.com")
    await user.click(screen.getByRole("button", { name: "Utwórz" }))

    expect(CREATE_MUTATION.mutateAsync.mock.calls[0]?.[0]?.name).toBe("Czat zewnętrzny")
  })
})
