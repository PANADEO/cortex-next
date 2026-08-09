import { getInstanceAppearance } from "@cortex/service"
import { PRESETS, isPresetId } from "./registry"

/**
 * Odczyt presetu instancji NA SERWERZE, dla korzenia dokumentu. Importuje go
 * wyłącznie `app/idp/app/layout.tsx` — nazwa `.server.ts` jest ostrzeżeniem dla
 * człowieka, bo `@cortex/service` wciąga drizzle i sterownik Postgresa, których
 * bundel kliencki nie zniesie.
 */
export interface InstancePresetRender {
  /** Wartość z bazy, bez zawężania — trafia propsem do `usePreset()`. */
  id: string | null
  /** Klasa `.skin-*` do wstawienia w `<html>`, albo `null`. */
  skinClass: string | null
}

const NOT_SET: InstancePresetRender = { id: null, skinClass: null }

/**
 * Górna granica CAŁEGO odczytu, nie samego łączenia.
 *
 * Skąd 500 ms: zmierzone na tej instancji zimne połączenie razem z zapytaniem
 * to 12–35 ms, a zapytanie na ciepłej puli 0,3 ms. Próg ma więc ~15-krotny
 * zapas wobec najgorszego przypadku ZDROWEJ bazy — czyli nie odpali przy
 * zimnym starcie po wdrożeniu ani przy chwilowym obciążeniu, bo przedwczesne
 * cięcie ma własną cenę: cichy powrót do wyglądu domyślnego na instancji,
 * która wygląd ustawiła. W dół (100 ms) ta cena rośnie, w górę zbliżamy się do
 * odczuwalnego opóźnienia dokumentu.
 */
const READ_TIMEOUT_MS = 500

class InstancePresetTimeoutError extends Error {
  constructor() {
    super(`Odczyt presetu instancji przekroczył ${READ_TIMEOUT_MS} ms`)
    this.name = "InstancePresetTimeoutError"
  }
}

/**
 * DLACZEGO WYŚCIG TUTAJ, A NIE `connect_timeout` W KLIENCIE.
 *
 * Dwa tryby awarii bazy wyglądają zupełnie inaczej. Odrzucone połączenie wraca
 * natychmiast i `catch` niżej wystarcza. Ale baza, która POŁYKA PAKIETY bez
 * odpowiedzi, nie wraca wcale: `postgres(url, { max: 5 })` w
 * `packages/@cortex/db/src/client.ts` nie ustawia `connect_timeout`, więc
 * obowiązuje domyślne 30 s — a od E5 blokuje to KORZEŃ DOKUMENTU, czyli całą
 * aplikację, także ekrany, które bazy nie potrzebują. Przed E5 wisiał sam hub.
 * Trzydzieści sekund za wartość, która jest WYGLĄDEM, to zły interes.
 *
 * `connect_timeout` w kliencie odrzucony z dwóch powodów, z których drugi jest
 * rozstrzygający:
 *  1. dotyka WSZYSTKICH konsumentów wspólnej puli (sześć modułów), czyli zmienia
 *     semantykę awarii w kodzie, którego to zadanie nie dotyka — a tolerancje są
 *     różne: admin zapisujący rolę woli poczekać niż dostać fałszywy błąd;
 *  2. ogranicza wyłącznie NAWIĄZANIE połączenia. Zerwanie sieci na już otwartym
 *     połączeniu zostawia zapytanie wiszące bez limitu, bo `postgres.js` nie ma
 *     domyślnego limitu zapytania. Wyścig ogranicza operację niezależnie od
 *     tego, w którym miejscu utknęła.
 *
 * Nie jest to argument PRZECIW `connect_timeout` w kliencie — to sensowne
 * utwardzenie całego repozytorium, tylko osobne zadanie i samo w sobie
 * niewystarczające tutaj.
 */
async function readPresetWithDeadline(): Promise<string | null> {
  const query = getInstanceAppearance().then((appearance) => appearance.preset)
  // Przegrany wyścig biegnie dalej i potrafi odrzucić się już PO rozstrzygnięciu.
  // Bez tego pochłaniacza jest to nieobsłużone odrzucenie, czyli w Node
  // wywrócenie procesu serwera — awaria znacznie gorsza od tej, którą leczymy.
  query.catch(() => {})

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new InstancePresetTimeoutError()), READ_TIMEOUT_MS)
  })

  try {
    return await Promise.race([query, deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Awaria bazy NIE MOŻE wywrócić ani zatrzymać dokumentu. Ten odczyt stoi na
 * ścieżce renderu KAŻDEJ strony, więc rzucony wyjątek zamieniłby niedostępny
 * Postgres z „hub pokazuje błąd wczytywania" (dzisiejsze zachowanie, bo katalog
 * i tak idzie z bazy) w „cała aplikacja zwraca 500", a zawieszony — w „cała
 * aplikacja nie odpowiada". Cena obu awarii to wygląd domyślny zamiast
 * narzuconego, i tylko tyle.
 */
export async function readInstancePreset(): Promise<InstancePresetRender> {
  let preset: string | null
  try {
    preset = await readPresetWithDeadline()
  } catch (error) {
    console.error("[presets] nie udało się odczytać presetu instancji:", error)
    return NOT_SET
  }

  // Nieznany identyfikator (preset skasowany z rejestru, ręczna edycja w bazie)
  // traktowany jak brak ustawienia — tak samo, jak zrobi z nim
  // `resolvePresetId()` na kliencie. Rozjazd tych dwóch znaczyłby klasę skinu
  // w HTML-u bez pokrycia w tym, co renderuje React.
  if (!isPresetId(preset)) return NOT_SET

  // `skin: ""` dla presetu bazowego (Neutral) — brak klasy jest jego poprawną
  // reprezentacją, nie brakiem danych.
  return { id: preset, skinClass: PRESETS[preset].skin || null }
}
