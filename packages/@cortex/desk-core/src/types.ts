/**
 * POWODY, dla których krok narzędzia się nie udał — SKOŃCZONA lista.
 *
 * Istnieje po to, żeby zdanie „co teraz” brało się z tego, CO SIĘ STAŁO, a nie z nazwy
 * narzędzia. Nazwa narzędzia nie mówi, czy powtórzenie ma sens: to samo `write_sheet`
 * raz pada przez brak zgody na folder (powtórzenie nic nie da), a raz przez chwilową
 * awarię dysku (powtórzenie jest jedyną sensowną radą).
 *
 * Lista jest zamknięta CELOWO. Powód spoza niej nie istnieje — jest za to `undefined`,
 * czyli „nie wiadomo”, i ono ma własne, bezpieczne zdanie. Dopisanie powodu wymaga
 * dopisania mu zdań w obu słownikach; pilnuje tego test `steps-failure.test.ts`.
 */
export type StepFailure =
  /** czynność zatrzymała się w połowie — nie wiemy, czy zdążyła cokolwiek zrobić */
  | "interrupted"
  /** ta osoba nie ma zgody na folder, którego czynność dotyczyła */
  | "no-access"
  /** pliku o tej nazwie nie ma tam, gdzie czynność go szukała */
  | "no-such-file"
  /** plik jest, ale nie dało się go otworzyć */
  | "cannot-open"
  /** plik jest innego rodzaju, niż ta czynność obsługuje */
  | "wrong-kind"
  /** dokument jest, ale nie dało się wyciągnąć z niego treści */
  | "cannot-recognise"
  /** zapis albo odłożenie pliku się nie powiodło */
  | "cannot-save"
  /** kod obliczenia przewrócił się na błędzie */
  | "computation-error"
  /** obliczenie oparło się o sufit czasu, pamięci albo rozmiaru wyniku */
  | "computation-stopped"
  /** usługa spoza Biurka nie dała rady */
  | "outside-service"
  /** wyjątek, którego nie umiemy nazwać — świadomie nazwany, a nie przemilczany */
  | "unknown"

/** Słownik zdarzeń jest NASZ. Żaden typ biblioteki agentowej nie przekracza tej granicy. */
export type DeskEvent =
  | {
      type: "lifecycle"
      /** `exhausted` — model nie skończył w limicie kroków; to NIE jest sukces ani awaria. */
      status: "start" | "end" | "stopped" | "failed" | "exhausted"
      reason?: string
      /**
       * `infrastructure` — awaria po stronie łącza, klucza albo środków, czyli rzeczy,
       * na które człowiek przy klawiaturze nie ma wpływu. Steruje JEDNĄ rzeczą: przyciskiem
       * pod kartą awarii. Bez tego pola ekran proponował „Napisz inaczej" także wtedy,
       * gdy padł cortex-proxy — czyli winił sformułowanie zlecenia za awarię sieci.
       */
      kind?: "infrastructure"
    }
  | { type: "prompt"; text: string; attachments?: string[] }
  | { type: "attachment"; names: string[] }
  | { type: "assistant"; text: string }
  | {
      type: "tool_start"
      id?: string
      name: string
      label: string
      args: Record<string, unknown>
      source?: string
    }
  | {
      type: "tool_end"
      id?: string
      name: string
      ok: boolean
      summary: string
      ms: number
      /**
       * POWÓD, dla którego krok się nie udał. Wpisuje go `runtime.ts` w chwili awarii;
       * przy kroku udanym go nie ma.
       *
       * DLACZEGO OSOBNE POLE, skoro obok stoi `summary`. `summary` jest ZDANIEM po polsku,
       * pisanym przy zapisie zdarzenia — nie da się go przetłumaczyć wstecz ani na nim
       * rozgałęzić bez dopasowywania napisów, a dopasowanie napisu do decyzji zerwało
       * w tym repozytorium już plakietkę „sprawdzony”. Powód jest WARTOŚCIĄ ze skończonej
       * listy, więc ekran może z niego wyprowadzić zdanie „co teraz” w obu językach.
       *
       * Pole jest opcjonalne, bo sprawy zapisane przed jego wprowadzeniem go nie mają —
       * i dlatego ekran musi mieć jedno bezpieczne zdanie domyślne.
       */
      reason?: StepFailure
      /**
       * ARGUMENTY, KTÓRYCH CZYNNOŚĆ NIE ZNAŁA NA STARCIE — dopisane przy zamknięciu kroku.
       *
       * Dowód czyta pliki wniesione do sprawy z `tool_start.args`, bo dotąd wszystkie
       * czynności wiedziały o nich z góry: `read_file` dostaje ścieżkę, `run_computation`
       * dostaje listę montowań. Szukanie w plikach jest pierwszą, która tego NIE wie —
       * o tym, do których plików zajrzała, dowiaduje się dopiero po przejrzeniu katalogu.
       *
       * Rozważone i odrzucone: wykonać pracę PRZED `tool_start` i wpisać wynik do jego
       * argumentów. Wtedy krok pojawiałby się na ekranie dopiero po zakończeniu, jego czas
       * trwania byłby zerowy, a czynność, która się przewróci, nie zostawiłaby ANI JEDNEGO
       * zdarzenia — czyli dokładnie ta cicha dziura, którą zamknął opakowywacz `step()`.
       *
       * `pairSteps` dokłada te wartości do argumentów kroku, więc dowód i strażnik obietnic
       * czytają je tą samą drogą co resztę i nie muszą wiedzieć, że powstały później.
       */
      discovered?: Record<string, unknown>
    }
  | {
      type: "blocked"
      description: string
      capabilityId?: string
      name?: string
      department?: string
    }
  // `basis` mówi, czy to pieniądze, czy zgadywanie. Dzienny limit pracownika jest
  // jedyną twardą granicą wydatków w tym produkcie, więc różnica między liczbą od
  // dostawcy a liczbą wyliczoną z wpisanych w kod stawek nie może być niewidoczna.
  | { type: "cost"; usd: number; basis: "provider" | "estimate" }

/**
 * Zdolność niesie TOŻSAMOŚĆ i DZIAŁ-właściciela, a nie słowa. Nazwa i opis stoją
 * w słowniku pod `capability.<id>` — inaczej katalog byłby po polsku także wtedy,
 * gdy cały ekran jest po angielsku. Dział jest tu wartością (`accounting`), nie
 * napisem do czytania; napis robi z niego `capability.department.<dział>`.
 */
export type Capability = { id: string; department: string }
export type Role = "member" | "management"

export type User = {
  id: string
  firstName: string
  lastName: string
  department: string
  role: Role
  /** Identyfikatory zleceń startowych; słowa stoją w słowniku pod `quickTask.<id>`. */
  quickTasks: string[]
  /** Limit dzienny tej osoby; brak znaczy „z roli". */
  dailyLimitUsd?: number | undefined
  /** Wyłączone konto nie wchodzi na Biurko, ale jego sprawy i dziennik zostają. */
  active?: boolean | undefined
}

/** Wynik materializacji polityki — to, co fizycznie trafia do instancji. */
export type Policy = {
  user: string
  role: Role
  granted: Capability[]
  blocked: Capability[]
  dailyLimitUsd: number
  fingerprint: string
}

export type CaseStatus = "new" | "working" | "done" | "stopped" | "failed"

export type Case = {
  id: string
  owner: string
  title: string
  status: CaseStatus
  createdAt: string
  updatedAt: string
  costUsd: number
  reason: string | null
}

/**
 * Stan zgody na narzędzie z serwera MCP. Stoi TUTAJ, a nie osobno w katalogu i osobno
 * w ekranie przełożonego, bo raz już się rozjechał: po przemianowaniu baza zaczęła
 * zapisywać `suspended`, a ekran dalej porównywał z `wstrzymane` — czyli ostrzeżenie
 * o wstrzymanym narzędziu przestało się pokazywać, i to bez jednego błędu kompilacji,
 * bo odpowiedź z `fetch` jest nietypowana. Wspólny typ zamienia to w błąd `tsc`.
 */
export type McpToolStatus = "approved" | "suspended"

export type AuditEntry = { seq: number; at: string; event: DeskEvent }

export type FileMeta = {
  path: string
  name: string
  folder: boolean
  size: number
  modifiedAt: string
}

/**
 * Pozycja w koszu. Typ jest TUTAJ, a nie osobno po obu stronach trasy, bo raz już się
 * rozjechał: serwer oddawał `basis`, ekran czytał `from` i rysował „z undefined" przy
 * każdym skasowanym pliku. Nic tego nie złapało — JSON z trasy nie ma typu, więc
 * niezgodność nazw pola jest dla `tsc` niewidzialna. Wspólny typ zamienia ją w błąd budowy.
 */
export type TrashEntry = {
  id: string
  name: string
  /** folder, z którego plik zniknął — potrzebny, żeby powiedzieć „z Moje pliki/faktury" */
  fromFolder: string
  when: string
}

/**
 * ZESTAWIENIE PORAŻEK dla przełożonego. Typ stoi TUTAJ, a nie osobno po obu stronach
 * trasy, z tego samego powodu co `TrashEntry`: odpowiedź z `fetch` jest nietypowana,
 * więc rozjazd nazw pól byłby dla `tsc` niewidzialny — a ekran, którym ktoś odpowiada
 * szefowi „czy to działa", ma mylić się głośno albo wcale.
 *
 * CZEGO W TYM TYPIE NIE MA I MIEĆ NIE BĘDZIE: tytułu sprawy, nazwy pliku ani opisu,
 * którym agent nazwał brakującą czynność. Sprawa jest prywatna, a wszystkie trzy są
 * treścią — tytuł bierze się z pierwszego zdania człowieka, a opis braku układa model
 * z tego, co miał zrobić. Przełożony dostaje LICZBY, POWODY i ZDOLNOŚCI, i to jest
 * cała treść tego zestawienia.
 */
export type Outcomes = {
  /** ile dni wstecz obejmuje zestawienie — ekran musi to powiedzieć, a nie założyć */
  days: number
  /** ile spraw skończyło się czym; stan jest wartością ze skończonej listy */
  cases: CaseCount[]
  /**
   * Ile procent ZAKOŃCZONYCH spraw skończyło się wynikiem. `null` znaczy „w tym oknie
   * nie skończyła się ani jedna" — a to jest inna odpowiedź niż zero.
   */
  resultShare: number | null
  /** powody PRZERWANIA — wartości ze skończonej listy, zdanie dobiera ekran */
  stops: StopCount[]
  /** nieudane czynności agenta, po powodzie ze skończonej listy `StepFailure` */
  steps: StepFailureCount[]
  /** kłódki: czynności, których komuś zabrakło, po zdolnościach */
  missing: MissingCapabilityCount[]
  cost: CostSplit
}

export type CaseCount = { status: CaseStatus; cases: number }

export type StopCount = { reason: string; cases: number }

export type StepFailureCount = {
  reason: StepFailure
  /** ile razy czynność się wywróciła */
  times: number
  /** w ilu RÓŻNYCH sprawach — czterdzieści awarii w dwóch sprawach to inna choroba */
  cases: number
}

export type MissingCapabilityCount = {
  /** `null` — czynność, której katalog zdolności w ogóle nie zna */
  capabilityId: string | null
  times: number
  /** ilu różnych ludzi trafiło na tę kłódkę; imion tu nie ma i nie potrzeba */
  people: number
}

/** Koszt rozbity na ten, który coś przyniósł, i ten, który nie. */
export type CostSplit = { withResult: number; withoutResult: number; unfinished: number }
