import { describe, expect, it } from "vitest"
import { getAuthErrorMessage } from "./auth-error-message"

describe("getAuthErrorMessage", () => {
  it("returns Auth0 error_description as the primary message", () => {
    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "Najpierw potwierdź adres e-mail, aby uzyskać dostęp.",
    })

    expect(getAuthErrorMessage(params)).toBe("Najpierw potwierdź adres e-mail, aby uzyskać dostęp.")
  })

  it("supports alternative message parameter names", () => {
    expect(getAuthErrorMessage(new URLSearchParams({ message: "Konto wymaga akceptacji." }))).toBe(
      "Konto wymaga akceptacji.",
    )
    expect(getAuthErrorMessage(new URLSearchParams({ reason: "Organizacja nieaktywna." }))).toBe(
      "Organizacja nieaktywna.",
    )
  })

  it("falls back to a generic access denied message", () => {
    expect(getAuthErrorMessage(new URLSearchParams({ error: "access_denied" }))).toBe(
      "Nie udało się zalogować.",
    )
  })

  it("returns null when no auth error is present", () => {
    expect(getAuthErrorMessage(new URLSearchParams())).toBeNull()
  })
})
