/**
 * Awaria mówi prawdę: po polsku, z powodem — i NIGDY nie produkuje pliku.
 *
 * Czysty moduł, bez zależności od runtime'u, żeby dało się go sprawdzić testem
 * bez stawiania modelu i bazy.
 */

export function readableFailure(e: unknown): string {
  const s = String((e as { message?: unknown })?.message ?? e)

  if (/401|unauthor|api key/i.test(s))
    return "Brak ważnego klucza do modelu — zgłoś to administratorowi."
  if (/timeout|ETIMEDOUT|aborted/i.test(s))
    return "Model nie odpowiedział na czas. Spróbuj ponownie za chwilę."
  // `bad port`, `getaddrinfo`, `ENOTFOUND` — dostawca nazywa to na kilkanaście sposobów,
  // a dla pracownika to jest jedna rzecz: usługa modelu jest nieosiągalna.
  if (
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|bad port|cannot connect|network/i.test(
      s,
    )
  )
    return "Nie udało się połączyć z usługą modelu. Sprawdź, czy cortex-proxy działa."
  if (/rate limit|429/i.test(s))
    return "Przekroczony limit zapytań u dostawcy modelu. Spróbuj za minutę."
  // Pułap na kluczu to nie brak środków, tylko za ciasna rezerwacja — dostawca liczy
  // ją z `max_tokens`, nie z tego, ile model naprawdę wypisze. Komunikat musi kierować
  // administratora tam, gdzie leży przyczyna, bo „doładuj konto" jej nie usuwa.
  if (/fewer max_tokens|can only afford/i.test(s))
    return "Pułap na kluczu do modelu jest za niski dla jednej tury — zgłoś to administratorowi. To nie jest Twój dzienny limit."
  // Rozróżnienie jest istotne: „skończył się budżet" brzmi jak dzienny limit z „Co potrafię",
  // a to zupełnie inna rzecz i inna osoba ją odblokowuje.
  if (/credit|quota|insufficient|billing|payment|afford/i.test(s))
    return "Skończyły się środki na modele po stronie firmy — zgłoś to administratorowi. To nie jest Twój dzienny limit."

  // Domyślne zdanie NIE wkleja cudzego tekstu.
  //
  // Zmierzone na ekranie pracownicy: „Nie udało się dokończyć: Failed after 3 attempts.
  // Last error: Cannot connect to API: bad port". Zdanie po angielsku, o rzeczy, na którą
  // ona nie ma wpływu, a jedyny przycisk obok proponował przeformułować zlecenie — czyli
  // awaria łącza podana jako wina jej sformułowania. Surowa treść nie znika: idzie do
  // dziennika (`turn.failed`, pole `raw`), gdzie czyta ją ten, kto może z nią coś zrobić.
  return "Coś poszło nie tak po stronie usługi modelu. Spróbuj jeszcze raz — jeśli się powtórzy, zgłoś to administratorowi."
}

/**
 * Czy ta awaria dotyczy INFRASTRUKTURY, a nie treści zlecenia.
 *
 * Rozróżnienie ma jeden odbiorca i jeden skutek: przycisk pod kartą awarii. Przy awarii
 * łącza „Napisz inaczej" jest złą radą — nie ma czego pisać inaczej — a przy odmowie
 * dostawcy z powodu treści jest jedyną sensowną.
 */
export function isInfrastructure(e: unknown): boolean {
  const s = String((e as { message?: unknown })?.message ?? e)
  return /401|unauthor|api key|timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|bad port|cannot connect|network|rate limit|429|credit|quota|insufficient|billing|payment|afford|max_tokens/i.test(
    s,
  )
}
