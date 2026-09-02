/**
 * KLIENT USŁUGI ROZPOZNAWANIA DOKUMENTÓW — cienka warstwa nad `services/document-parser`.
 *
 * DLACZEGO WŁASNY, A NIE `app/idp/lib/document-parser/backend-client.ts`. Rozważone były
 * trzy drogi i dwie odpadły z powodów twardych, nie estetycznych:
 *
 *  1. IMPORT tamtego modułu — niemożliwy. `desk-core` jest pakietem workspace, który stoi
 *     także w `apps/desk` (osobna aplikacja Next z własnym `tsconfig`, bez aliasu `@/*`
 *     i bez katalogu `app/idp` w drzewie budowania). Zależność w tę stronę wywraca
 *     budowanie Biurka jako aplikacji samodzielnej — a to jest jedno z dwóch miejsc,
 *     w których ten produkt stoi.
 *  2. PRZENIESIENIE tamtego modułu tutaj — kosztowne bez zysku. Z tamtego klienta korzysta
 *     dziś kafelek IDP (trasy `app/api/document-parser/**`), więc przeniesienie znaczy
 *     albo zależność `app/idp` → `desk-core` (czyli wciągnięcie całego Biurka do bundla
 *     kafelka), albo równoległe utrzymywanie kopii i tak.
 *  3. WŁASNA CIENKA WARSTWA — wybrana. Powód nie sprowadza się do granic pakietów:
 *     te dwa moduły mają PRZECIWNE kształty. Tamten bierze przeglądarkowy `File`, rozdziela
 *     `createBackendJob` od `getBackendJob`, bo wołający trzyma wiersz zadania w Postgresie
 *     i odpytuje go z Reacta, i mapuje treść błędu na `JobErrorCode` swojej kolumny.
 *     Biurko potrzebuje odwrotności: bajtów z dysku po stronie serwera i JEDNEGO wywołania
 *     z twardym terminem, które MUSI wrócić — bo krok narzędzia domyka parę
 *     `tool_start`/`tool_end` i nie ma dokąd odłożyć zadania „na później”.
 *
 * Wspólny zostaje kontrakt drutu (`snake_case` prosto z Pydantica, patrz
 * `services/document-parser/src/models.py`) i NAZWA ZMIENNEJ ŚRODOWISKOWEJ — jedno
 * ustawienie instancji konfiguruje obu odbiorców. To jest zamierzone: adres usługi jest
 * własnością wdrożenia, a nie żadnego z dwóch klientów.
 *
 * CZYM TA TREŚĆ JEST. Usługa renderuje strony (`pypdfium2`) i pyta o nie model wizyjny
 * przez cortex-proxy. Wynik JEST TEKSTEM MODELU — nie bajtami pliku. Dlatego stoi tu
 * osobna czynność, osobna karta i osobna fraza dowodu (ADR-0001 §8), a odpowiedź dla
 * modelu zaczyna się od zdania, które to mówi.
 */

/** Adres usługi w sieci compose — `services/document-parser` nie ma `ports:` (D6). */
const DEFAULT_BACKEND_URL = "http://document-parser-backend:8000"

/**
 * Pusty napis to NIE jest wartość: compose wstawia `VAR: ${VAR:-}`, więc nieustawiona
 * zmienna dociera tu jako `""`. Ta sama pułapka i to samo rozwiązanie, co w
 * `app/idp/lib/document-parser/config.ts`.
 */
export function documentParserUrl(): string {
  const given = process.env.DOCUMENT_PARSER_BACKEND_URL?.trim()
  return (given || DEFAULT_BACKEND_URL).replace(/\/$/, "")
}

/**
 * Formaty, które warto posyłać do rozpoznawania.
 *
 * ŚWIADOMIE BEZ `txt`, `csv` i `md`: te pliki czyta `read_file` — bajtami, za darmo
 * i dosłownie. Puszczenie ich tędy zamieniłoby pewny odczyt w zgadywanie modelu
 * i jeszcze policzyłoby za to pieniądze. Lista jest węższa niż `ALLOWED_EXTENSIONS`
 * kafelka IDP dokładnie o te trzy pozycje i o tę jedną różnicę chodzi.
 */
export const RECOGNISABLE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
  "doc",
  "docx",
  "odt",
  "rtf",
  "xls",
  "xlsx",
  "ods",
  "ppt",
  "pptx",
  "odp",
])

export function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? path
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

export const isRecognisable = (path: string) => RECOGNISABLE_EXTENSIONS.has(extensionOf(path))

export type RecognisedDocument = {
  /** treść oddana przez model wizyjny — markdown */
  markdown: string
  /** ile stron MA dokument */
  pages: number
  /** ile stron naprawdę poszło do modelu — mniej niż `pages` znaczy obcięcie */
  recognisedPages: number
  /** usługa przekroczyła własny `MAX_PAGES` i przetworzyła sam początek */
  truncated: boolean
  model: string | null
}

/** Jedna klasa błędu na każdą przyczynę — wołający zamienia ją na jedno zdanie dla modelu. */
export class DocumentParserFailure extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "DocumentParserFailure"
  }
}

/** `POST /jobs` odpowiada natychmiast po odczytaniu pliku — to jest czas na sam transfer. */
const CREATE_TIMEOUT_MS = 30_000
/** `GET /jobs/:id` to odczyt stanu z pamięci procesu. */
const STATUS_TIMEOUT_MS = 10_000
const POLL_EVERY_MS = 1_500

/**
 * Termin CAŁEGO rozpoznania. Musi istnieć, bo bez niego krok narzędzia wisiałby tyle,
 * ile trwa awaria po drugiej stronie — a para zdarzeń ma się domknąć zawsze.
 * Dwadzieścia stron przez model wizyjny to realnie kilkadziesiąt sekund; trzy minuty
 * zostawiają zapas i dalej mieszczą się poniżej cierpliwości człowieka przy ekranie.
 */
const deadlineFromEnv = () => Number(process.env.DOCUMENT_PARSER_TIMEOUT_MS ?? 180_000)

type WireJob = {
  job_id: string
  status: "processing" | "done" | "error"
  markdown: string | null
  error_message: string | null
  page_count: number
  image_count: number
  truncated: boolean
  model: string | null
}

const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

async function call(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" })
  } catch (e) {
    throw new DocumentParserFailure("usługa rozpoznawania dokumentów nie odpowiada", e)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Wysyła plik i CZEKA na wynik.
 *
 * Nadpisania są wyłącznie dla testów — produkcja bierze wartości ze stałych i ze
 * zmiennej środowiskowej. Wstrzykiwanie ich parametrem, a nie mockowaniem `setTimeout`,
 * bo test odpytywania ma sprawdzać pętlę, a nie zegar biblioteki.
 */
export async function recogniseDocument(
  input: { fileName: string; bytes: Buffer; user: string },
  overrides: { pollEveryMs?: number; deadlineMs?: number } = {},
): Promise<RecognisedDocument> {
  const base = documentParserUrl()
  const pollEveryMs = overrides.pollEveryMs ?? POLL_EVERY_MS
  const until = Date.now() + (overrides.deadlineMs ?? deadlineFromEnv())

  const form = new FormData()
  // Nazwa pliku jedzie osobno, bo po niej usługa rozpoznaje format (`pipeline.py`
  // patrzy na sufiks, nie na typ MIME).
  form.append("file", new Blob([new Uint8Array(input.bytes)]), input.fileName)
  // Rejestr cortex-proxy ma widzieć OSOBĘ, nie usługę — usługa przekłada to pole
  // na nagłówek `X-User-ID` przy wywołaniu modelu.
  form.append("user_email", input.user)

  const created = await call(`${base}/jobs`, { method: "POST", body: form }, CREATE_TIMEOUT_MS)
  if (!created.ok) {
    const text = await created.text().catch(() => "")
    throw new DocumentParserFailure(text.slice(0, 200) || `usługa odpowiedziała ${created.status}`)
  }
  const { job_id: jobId } = (await created.json()) as { job_id: string }

  for (;;) {
    if (Date.now() > until) {
      throw new DocumentParserFailure("rozpoznawanie trwało zbyt długo i zostało przerwane")
    }
    await delay(pollEveryMs)

    const answer = await call(
      `${base}/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET" },
      STATUS_TIMEOUT_MS,
    )
    // 404 to nie to samo co awaria sieci: usługa zapomniała zadanie (restart albo TTL),
    // czyli stan jest stracony na trwałe i powtarzanie odpytywania niczego nie przywróci.
    if (answer.status === 404) {
      throw new DocumentParserFailure("usługa zgubiła zadanie, zanim je skończyła")
    }
    if (!answer.ok) {
      throw new DocumentParserFailure(`usługa odpowiedziała ${answer.status}`)
    }

    const job = (await answer.json()) as WireJob
    if (job.status === "processing") continue
    if (job.status === "error") {
      throw new DocumentParserFailure(job.error_message?.slice(0, 200) || "rozpoznanie nie wyszło")
    }
    // `done` z pustą treścią to nie sukces. Bez tej gałęzi dowód poświadczyłby odczyt
    // dokumentu, z którego do sprawy nie weszło ani jedno zdanie.
    if (!job.markdown?.trim()) {
      throw new DocumentParserFailure("usługa nie oddała żadnej treści")
    }
    return {
      markdown: job.markdown.trim(),
      pages: job.page_count,
      recognisedPages: job.image_count,
      truncated: job.truncated,
      model: job.model,
    }
  }
}

/** Formy liczby mnogiej dla stron — podsumowanie kroku zapisuje się w zdarzeniu dosłownie. */
function pagesText(count: number): string {
  const last = count % 10
  const lastTwo = count % 100
  if (count === 1) return "1 strona"
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} strony`
  return `${count} stron`
}

/**
 * Podsumowanie kroku, czyli szczegół wiersza dowodu.
 *
 * OBCIĘCIE MUSI BYĆ WIDOCZNE. Usługa przetwarza najwyżej `MAX_PAGES` stron
 * (`services/document-parser/src/config.py`, domyślnie 20) i resztę PO CICHU pomija —
 * oddaje `truncated: true` i tyle. Wynik obcięty, nieodróżnialny od kompletnego, jest
 * w tym produkcie osobną klasą błędu: zdarzył się już przy odczycie pliku, przy wyjściu
 * z piaskownicy i tutaj byłby trzeci raz. Dlatego liczba stron NIE jest ozdobą
 * podsumowania, tylko jego treścią.
 */
export function recognitionSummary(r: Pick<
  RecognisedDocument,
  "pages" | "recognisedPages" | "truncated"
>): string {
  if (!r.truncated && r.recognisedPages >= r.pages) return pagesText(r.pages)
  return `${r.recognisedPages} z ${pagesText(r.pages)}; dalszych nie odczytano`
}

/**
 * Odpowiedź dla MODELU — treść opatrzona tym, czym naprawdę jest.
 *
 * Ramka nie jest ostrożnościowym dopiskiem. Model, który dostanie sam markdown, napisze
 * potem „w pliku jest kwota 4 672,77 zł” z pewnością należną odczytowi bajtów — a to
 * była odpowiedź innego modelu na obrazek. Zdanie na wejściu jest jedynym miejscem,
 * w którym da się tę różnicę przekazać.
 */
export function recognitionAnswer(name: string, r: RecognisedDocument): string {
  const head =
    `[Treść poniżej powstała z ROZPOZNANIA obrazu stron pliku ${name} przez model, ` +
    "a nie z odczytania jego tekstu. Kwoty, numery i daty sprawdź, zanim je przepiszesz, " +
    "i nie przedstawiaj tego jako dosłownej treści dokumentu.]"
  const tail = r.truncated
    ? `\n\n[Dokument ma ${pagesText(r.pages)}, rozpoznano pierwsze ${r.recognisedPages}. ` +
      "Treści dalszych stron TU NIE MA — nie twierdź, że znasz całość, i powiedz o tym człowiekowi.]"
    : ""
  return `${head}\n\n${r.markdown}${tail}`
}

/**
 * Zwraca wyjaśnienie po polsku, jeśli pliku po prostu nie da się przeczytać jako tekst.
 *
 * STOI TUTAJ, a nie w `runtime.ts`, z dwóch powodów. Pierwszy jest treściowy: to zdanie
 * decyduje, KTÓRĄ drogą da się dotrzeć do treści pliku, więc mieszka razem z listą
 * formatów, które ta druga droga obsługuje — inaczej rozjazd między nimi byłby cichy.
 * Drugi jest praktyczny: `runtime.ts` ciągnie za sobą pulę Postgresa i bibliotekę
 * agentową, a scenariusze i testy pytają o to zdanie bez jednego i bez drugiego.
 *
 * `mayRecognise` rozdziela to zdanie na dwa różne, bo to są dwie różne sytuacje.
 * Osoba ze zdolnością `document.read` ma dostać ADRES czynności, która to potrafi —
 * dotąd agent odpowiadał jej „nie umiem odczytać PDF-a” mimo stojącej obok usługi,
 * i to był dla księgowej moment, w którym produkt przestawał działać. Osoba bez tej
 * zdolności ma dostać wskazówkę, jak o nią poprosić — ślepa odmowa produkuje agenta,
 * który próbuje w kółko, i człowieka, który nie wie, kogo zapytać.
 */
export function notReadable(path: string, mayRecognise: boolean): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  // Zgłoszenie idzie do przełożonego DOPIERO z czynności `report_gap` — bez zdarzenia
  // nie ma prośby o dostęp, więc agent ma tu przeczytać, że ma ją wywołać.
  const askForIt =
    " Rozpoznawanie dokumentów jest osobną zdolnością, której ta osoba nie ma — jeśli " +
    "bez niej zlecenia nie da się wykonać, zgłoś to najpierw narzędziem report_gap."
  const useIt = (what: string) =>
    `Nie umiem odczytać ${what} jako tekstu, ale umiem go rozpoznać: wywołaj read_document ` +
    `na ścieżce ${path}. Treść powstanie z rozpoznania obrazu stron przez model, więc nie jest ` +
    "dosłowną zawartością pliku — kwoty i numery podawaj jako odczytane, nie jako pewne."

  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic"].includes(ext)) {
    // Załącznik zostaje pierwszą radą także wtedy, gdy zdolność jest: model widzi wtedy
    // obraz sam, bez pośrednika i bez drugiego rachunku za wywołanie modelu wizyjnego.
    const attach =
      "To jest obraz, nie plik tekstowy. Poproś użytkownika, żeby dołączył go do wiadomości — wtedy go zobaczysz."
    return mayRecognise
      ? `${attach} Jeśli obraz ma zostać ODCZYTANY jako dokument (skan, zdjęcie faktury), wywołaj read_document na ścieżce ${path}.`
      : attach
  }
  if (["xlsx", "xls"].includes(ext)) {
    const csv =
      "Nie umiem otworzyć pliku Excela. Poproś użytkownika, żeby zapisał go jako CSV (w Excelu: Plik → Zapisz jako → CSV) i wgrał ponownie."
    // Przy arkuszu rada o CSV zostaje PIERWSZA i to nie jest ostrożność: liczby odczytane
    // z obrazu tabeli są domysłem modelu, a arkusz ma się zgadzać co do grosza.
    return mayRecognise
      ? `${csv} Jeśli to niemożliwe, wywołaj read_document na ścieżce ${path} — ale wtedy liczby są ROZPOZNANE, nie odczytane, i trzeba to powiedzieć.`
      : `${csv}${askForIt}`
  }
  if (ext === "docx" || ext === "doc") {
    return mayRecognise
      ? useIt("pliku Worda")
      : "Nie umiem otworzyć pliku Worda. Poproś użytkownika o wersję w formacie tekstowym albo o wklejenie treści." +
          askForIt
  }
  if (ext === "pdf") {
    return mayRecognise
      ? useIt("PDF-a")
      : "Nie umiem odczytać PDF-a. Poproś użytkownika o wersję tekstową albo o wklejenie potrzebnego fragmentu." +
          askForIt
  }
  if (["zip", "rar", "7z", "exe", "dmg"].includes(ext)) {
    // Archiwum i program zostają bez propozycji: tego nie umie ANI `read_file`,
    // ani rozpoznawanie, więc odesłanie do zdolności byłoby obietnicą bez pokrycia.
    return "To jest archiwum albo program, nie dokument. Nie umiem tego otworzyć."
  }
  return null
}
