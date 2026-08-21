import { beforeEach, describe, expect, it, vi } from "vitest"

const toastError = vi.fn()
vi.mock("sonner", () => ({ toast: { error: toastError } }))

const { ApiError } = await import("./error")
const { toastApiError } = await import("./toast")

/** Odpowiedź bez `message` w ciele, ale z frazą protokołu — dokładnie to,
 *  co zwraca trasa po przejściu na kontrakt „serwer oddaje KOD". */
function responseWithoutMessage(body: unknown, status = 400, statusText = "Bad Request") {
  return new Response(JSON.stringify(body), { status, statusText })
}

describe("toastApiError", () => {
  beforeEach(() => toastError.mockClear())

  // Sedno: `Error.message` spada na `statusText`, żeby log nie był pusty.
  // Gdyby toast czytał to samo pole, użytkownik dostawałby frazę HTTP.
  it("nie pokazuje frazy protokołu HTTP, gdy serwer nie przysłał zdania", async () => {
    const error = await ApiError.fromResponse(responseWithoutMessage({ error: "missing-file" }))

    expect(error.message).toBe("Bad Request")
    expect(error.userMessage).toBeNull()

    toastApiError(error, "Nie udało się wysłać pliku")
    expect(toastError).toHaveBeenCalledWith("Nie udało się wysłać pliku")
  })

  it("kod błędu wygrywa z zapasem wołającego", async () => {
    const error = await ApiError.fromResponse(
      responseWithoutMessage({ error_code: "PERMISSION_DENIED" }, 403, "Forbidden"),
    )

    toastApiError(error, "Zapas")
    expect(toastError).toHaveBeenCalledWith("Nie masz uprawnień do wykonania tej akcji.")
  })

  it("zdanie od serwera wygrywa ze wszystkim", async () => {
    const error = await ApiError.fromResponse(
      responseWithoutMessage({ message: "Paczka jest w trakcie przetwarzania." }, 409, "Conflict"),
    )

    expect(error.userMessage).toBe("Paczka jest w trakcie przetwarzania.")
    toastApiError(error, "Zapas")
    expect(toastError).toHaveBeenCalledWith("Paczka jest w trakcie przetwarzania.")
  })

  // Bez tego wołający, który nie poda zapasu, dostawał zaszyty angielski
  // niezależnie od wybranego języka.
  it("bez zapasu wołającego bierze komunikat ogólny z tłumaczeń", async () => {
    const error = await ApiError.fromResponse(
      responseWithoutMessage({}, 500, "Internal Server Error"),
    )

    toastApiError(error)
    expect(toastError).toHaveBeenCalledWith("Coś poszło nie tak")
  })
})
