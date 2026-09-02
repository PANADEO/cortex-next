/**
 * Awaria mówi prawdę: po polsku, z powodem — i NIGDY nie produkuje pliku.
 *
 * Czysty moduł, bez zależności od runtime'u, żeby dało się go sprawdzić testem
 * bez stawiania modelu i bazy.
 *
 * DWIE ZASADY, KTÓRYCH TE ZDANIA PILNUJĄ — obie spisane po tym, jak je złamano:
 *
 *  1. ŻADNEJ NASZEJ INFRASTRUKTURY W ZDANIU DLA PRACOWNICY. Najczęstsze zdanie tego
 *     modułu brzmiało „Sprawdź, czy cortex-proxy działa" — czyli nazwa kontenera podana
 *     księgowej jako polecenie. Ona nie ma jak tego sprawdzić i nie ma prawa wiedzieć,
 *     że coś takiego istnieje. Nazwa nie znika bez śladu: idzie do dziennika (`turn.failed`,
 *     pole `raw`), gdzie czyta ją ten, kto może z nią coś zrobić.
 *
 *  2. ŻADNEGO ŚLEPEGO ZAUŁKA. Cztery zdania kończyły się na „zgłoś to administratorowi"
 *     i to było wszystko, co człowiek dostawał: rola bez zadania, bez treści zgłoszenia,
 *     często zamiast czynności, którą mógł wykonać sam. Teraz każde zdanie albo daje
 *     ruch do wykonania TERAZ, albo zamienia zgłoszenie w konkretne polecenie — co
 *     powiedzieć — a nigdy nie zostawia samej roli.
 *
 * CZEGO TE ZDANIA ŚWIADOMIE NIE MÓWIĄ: „nic się nie zmieniło". Tura potrafi paść PO kilku
 * udanych krokach, więc zapewnienie o nietkniętych plikach byłoby tu nieprawdą. To zdanie
 * należy do kroku narzędzia, gdzie da się je oprzeć na zdarzeniu — patrz `describeFailure`
 * w `steps.ts`.
 */

export function readableFailure(e: unknown): string {
  const s = String((e as { message?: unknown })?.message ?? e)

  if (/401|unauthor|api key/i.test(s))
    return (
      "Brak ważnego klucza do modelu — bez niego asystent nie zacznie pracy. " +
      "Powiedz administratorowi, że Biurko zgłasza brak ważnego klucza do modelu."
    )
  if (/timeout|ETIMEDOUT|aborted/i.test(s))
    return "Model nie odpowiedział na czas. Spróbuj ponownie za chwilę."
  // `bad port`, `getaddrinfo`, `ENOTFOUND` — dostawca nazywa to na kilkanaście sposobów,
  // a dla pracownika to jest jedna rzecz: usługa modelu jest nieosiągalna.
  if (
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|bad port|cannot connect|network/i.test(
      s,
    )
  )
    return (
      "Nie udało się połączyć z usługą modelu. Poproś o to samo jeszcze raz za minutę; " +
      "jeśli i wtedy nie zadziała, powiedz administratorowi, że Biurko nie łączy się z usługą modelu."
    )
  if (/rate limit|429/i.test(s))
    return "Przekroczony limit zapytań u dostawcy modelu. Spróbuj za minutę."
  // Pułap na kluczu to nie brak środków, tylko za ciasna rezerwacja — dostawca liczy
  // ją z `max_tokens`, nie z tego, ile model naprawdę wypisze. Komunikat musi kierować
  // administratora tam, gdzie leży przyczyna, bo „doładuj konto" jej nie usuwa.
  if (/fewer max_tokens|can only afford/i.test(s))
    return (
      "Pułap na kluczu do modelu jest za niski dla jednej tury. To nie jest Twój dzienny limit. " +
      "Powiedz administratorowi, że trzeba podnieść pułap na kluczu — doładowanie konta tego nie usunie."
    )
  // Rozróżnienie jest istotne: „skończył się budżet" brzmi jak dzienny limit z „Co potrafię",
  // a to zupełnie inna rzecz i inna osoba ją odblokowuje.
  if (/credit|quota|insufficient|billing|payment|afford/i.test(s))
    return (
      "Skończyły się środki na modele po stronie firmy. To nie jest Twój dzienny limit. " +
      "Powiedz administratorowi, że u dostawcy modeli skończyły się środki."
    )

  // Domyślne zdanie NIE wkleja cudzego tekstu.
  //
  // Zmierzone na ekranie pracownicy: „Nie udało się dokończyć: Failed after 3 attempts.
  // Last error: Cannot connect to API: bad port". Zdanie po angielsku, o rzeczy, na którą
  // ona nie ma wpływu, a jedyny przycisk obok proponował przeformułować zlecenie — czyli
  // awaria łącza podana jako wina jej sformułowania. Surowa treść nie znika: idzie do
  // dziennika (`turn.failed`, pole `raw`), gdzie czyta ją ten, kto może z nią coś zrobić.
  return (
    "Coś poszło nie tak po stronie usługi modelu. Poproś o to samo jeszcze raz; " +
    "jeśli nie uda się drugi raz, powiedz administratorowi, że praca urywa się bez podania powodu."
  )
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

/**
 * OSTATNIA LINIA BŁĘDU Z PIASKOWNICY — żeby „nie udało się" przestało być całą wiedzą.
 *
 * DLACZEGO POWSTAŁO. Nieudane obliczenie zapisywało w sprawie jedno zdanie: „błąd
 * wykonania". Treść błędu — traceback, który kod naprawdę wypisał — szła do modelu
 * i przepadała, więc ani człowiek, ani wsparcie nie miało z czego zdiagnozować, co się
 * zepsuło. Zmierzone na żywej sprawie: trzy nieudane obliczenia, 96 bajtów treści błędu,
 * i ani jednego znaku z tego w dowodzie.
 *
 * DLACZEGO TO NIE JEST ZŁAMANIE REGUŁY „surowa treść wyjątku nie wychodzi do dowodu".
 * Tamta reguła chroni przed wyciekiem NASZYCH wnętrzności — ścieżek na serwerze i treści
 * wyjątków Node'a z warstwy plików. Tutaj mówimy o błędzie KODU, który agent sam napisał
 * i który wykonał się w piaskownicy: to jest wynik jego pracy, a nie nasza infrastruktura.
 *
 * Bierzemy WYŁĄCZNIE ostatnią niepustą linię, bo w Pythonie i w Node to jest linia
 * z typem i komunikatem wyjątku, a wszystko powyżej to ścieżki w kodzie tymczasowym,
 * które nikomu nic nie mówią. Twardy sufit, bo komunikat wyjątku potrafi nieść wartość
 * z pliku klienta (`KeyError: 'nazwa kontrahenta'`) — jedna linia to diagnoza,
 * a cały traceback byłby kopią danych w drugim miejscu.
 */
export function sandboxFailureLine(output: string, limit = 120): string {
  const lines = output.split("\n").map((l) => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (line === "") continue
    // Wiersze ramki tracebacku same w sobie nic nie znaczą — szukamy dalej w górę.
    if (line.startsWith('File "') || line.startsWith("Traceback") || line.startsWith("at ")) {
      continue
    }
    return line.length > limit ? `${line.slice(0, limit)}…` : line
  }
  return ""
}
