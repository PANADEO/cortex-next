/**
 * SUFITY WYWOŁANIA MCP — czas i długość odpowiedzi.
 *
 * Moduł jest CZYSTY i osobny od klienta z tego samego powodu, co `hygiene.ts`: to jedyne
 * dwie rzeczy w warstwie MCP, które da się sprawdzić testem bez stawiania serwera,
 * i zarazem jedyne, w których błąd nie objawia się awarią, tylko cichą zmianą zachowania —
 * turą, która wisi bez końca, albo wynikiem obciętym nieodróżnialnie od kompletnego.
 */

/**
 * Ile czekamy na JEDNO wywołanie narzędzia.
 *
 * SKĄD 30 SEKUND. Tyle samo, ile wynosi limit jednej sprawy w piaskownicy
 * (`sandbox.ts`, `limits.seconds = 30`) — dwie rzeczy, które w turze potrafią stanąć,
 * mają stać tak samo długo, bo dla człowieka patrzącego na krok „w toku" to jest jedna
 * i ta sama sytuacja. Wyżej być nie może: tura robi do dwunastu kroków (`stepCountIs(12)`
 * w `runtime.ts`), więc sam sufit razy dwanaście to już sześć minut milczenia.
 *
 * Uwaga o bibliotece: `@ai-sdk/mcp` NIE MA własnego zegara. `request()` rozwiązuje się
 * dopiero, gdy przyjdzie odpowiedź, a `signal` sprawdza wyłącznie w chwili jej przyjścia —
 * czyli przerwanie sygnałem nie odwiesza zawieszonego wywołania. Zegar musi być NASZ.
 */
export const CALL_DEADLINE_MS = 30_000

/**
 * Ile czekamy na `tools/list` na ekranie przyjmowania.
 *
 * Krócej niż na wywołanie i to jest różnica w odbiorcy, nie w technice: tam czeka model
 * w środku tury, tutaj stoi przełożony przed formularzem. Człowiek przy ekranie czeka
 * sekundy, nie pół minuty, a `tools/list` to zapytanie o metadane — serwer, który nie
 * umie go oddać w dziesięć sekund, i tak nie nadaje się do wpuszczenia do tury.
 */
export const INSPECT_DEADLINE_MS = 10_000

/**
 * Sufit długości odpowiedzi serwera, liczony w znakach postaci JSON.
 *
 * SKĄD 60 000. Tyle samo, ile `READ_LIMIT` w `runtime.ts`, czyli sufit `read_file` — to jest
 * liczba, którą ten produkt już raz świadomie przyjął jako „najwięcej, ile jedna czynność
 * ma prawo wlać do tury". Odpowiedź obcego serwera jest tym samym rodzajem rzeczy: obcym
 * tekstem wchodzącym do okna kontekstu i do rachunku. Niżej nie schodzimy, bo prawdziwe
 * wywołanie wykazu podatników oddaje kilkaset bajtów i sufit ma łapać serwer oddający
 * dziesięć megabajtów, a nie skracać poprawne odpowiedzi. Wyżej nie idziemy, bo dwanaście
 * kroków po sufit to już cała tura zjedzona jednym serwerem.
 */
export const RESULT_CEILING = 60_000

/**
 * ZDANIE, KTÓRE MODEL DOSTAJE ZAMIAST RESZTY.
 *
 * W tym produkcie ciche obcięcie zdarzyło się już kilka razy — `read_file`, stdout ścieżki
 * zastępczej piaskownicy, `document-parser` po `MAX_PAGES=20` — i jest uznane za KLASĘ
 * BŁĘDU, nie drobiazg. Dwa pierwsze zostały już naprawione i obcięcie MÓWI tam o sobie
 * w obu kierunkach (w dowodzie i w odpowiedzi dla modelu); ten sufit powstaje od razu
 * w tym kształcie. Wynik obcięty musi być nieodróżnialny od
 * kompletnego wyłącznie dla kogoś, kto nie czyta; dla modelu i dla człowieka ma być
 * odróżnialny natychmiast. Stąd nie sam `slice`, tylko inny KSZTAŁT odpowiedzi:
 * pole `incomplete` w danych i zdanie wprost w tekście.
 */
const CLIP_NOTE =
  "To NIE jest cała odpowiedź serwera — była dłuższa niż sufit i została obcięta. " +
  "Nie wyciągaj z niej wniosków o kompletności; jeżeli brakuje czegoś, czego szukasz, " +
  "powiedz człowiekowi wprost, że odpowiedź serwera była za długa i widzisz tylko jej początek."

export type Clipped = {
  /** `false` znaczy: to jest CAŁA odpowiedź serwera, nietknięta */
  clipped: boolean
  /** długość pełnej odpowiedzi w znakach — idzie do podsumowania dla człowieka */
  length: number
  /** to, co dostaje model */
  value: unknown
}

/**
 * Przycina odpowiedź serwera do sufitu, ZAWSZE mówiąc o tym w samej odpowiedzi.
 *
 * Odpowiedź nieprzycięta wraca w postaci NIETKNIĘTEJ — nie opakowanej, nie przepisanej.
 * Sufit nie ma prawa zmieniać kształtu poprawnego wyniku, bo wtedy każde narzędzie MCP
 * zaczyna wyglądać inaczej niż to, co wystawia serwer.
 */
export function clipResult(value: unknown, ceiling: number = RESULT_CEILING): Clipped {
  // `undefined` z `JSON.stringify` (funkcja, symbol) traktujemy jak pustą odpowiedź —
  // przycinanie i tak jej nie dotyczy, a rzutowanie na "undefined" kłamałoby o długości.
  const text = JSON.stringify(value) ?? ""
  if (text.length <= ceiling) return { clipped: false, length: text.length, value }
  return {
    clipped: true,
    length: text.length,
    value: {
      incomplete: true,
      note: CLIP_NOTE,
      limit: ceiling,
      length: text.length,
      content: text.slice(0, ceiling),
    },
  }
}

export type Raced<T> = { late: true } | { late: false; value: T }

/**
 * Zegar po NASZEJ stronie. Biblioteka go nie ma — patrz uwaga przy `CALL_DEADLINE_MS`.
 *
 * Zgubiona obietnica jest tu świadoma: gdy wygra budzik, `work` zostaje w powietrzu, bo
 * transport nie daje jak anulować żądania w locie. Nie grozi to nieobsłużonym odrzuceniem
 * — `Promise.race` podpina do `work` własną obsługę — a jedynym kosztem jest gniazdo
 * otwarte do czasu, aż serwer odpowie albo połączenie padnie.
 */
export function withDeadline<T>(ms: number, work: Promise<T>): Promise<Raced<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const alarm = new Promise<Raced<T>>((resolve) => {
    timer = setTimeout(() => resolve({ late: true }), ms)
  })
  return Promise.race([work.then((value) => ({ late: false, value }) as Raced<T>), alarm]).finally(
    () => clearTimeout(timer),
  )
}

/**
 * Cisza serwera na `tools/list`. Osobna klasa, bo ekran przełożonego ma z niej zrobić
 * inne zdanie niż z awarii połączenia: „nie odpowiedział" to nie to samo, co „nie ma go
 * pod tym adresem", a przełożony na podstawie tej różnicy podejmuje inną decyzję.
 */
export class NoAnswerInTime extends Error {
  constructor(readonly ms: number) {
    super(`Serwer nie odpowiedział w ciągu ${Math.round(ms / 1000)} s.`)
  }
}
