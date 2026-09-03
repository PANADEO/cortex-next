import { migrate, pool } from "./db"
import { STEP_FAILURES } from "./steps"
import type {
  CaseCount,
  CaseStatus,
  CostSplit,
  MissingCapabilityCount,
  Outcomes,
  StepFailureCount,
  StopCount,
} from "./types"

/**
 * CO SIĘ NIE UDAŁO — zestawienie, którego przełożony nie miał.
 *
 * Dane leżą w bazie od pierwszego dnia: stan sprawy, powód zatrzymania, zdarzenia
 * `tool_end` z `ok:false`, zdarzenia `blocked`. Nikt ich nie zestawiał, więc Robert —
 * pytany przez swojego szefa „czy to działa" i „czy warto płacić" — miał do dyspozycji
 * czterdzieści wierszy dziennika i sumę dzisiejszych wydatków. Ten moduł nie zbiera
 * ŻADNEJ nowej telemetrii, tylko liczy to, co już jest.
 *
 * TRZY REGUŁY, KTÓRE TE ZAPYTANIA TRZYMAJĄ — każda spisana przy konkretnym `select`:
 *
 *  1. SPRAWA JEST PRYWATNA. Stąd `count(*)`, `count(distinct …)` i wartości ze
 *     skończonych list — a nigdy `title`, `summary` ani `description`. Tytuł sprawy JEST
 *     treścią: `case-turn.ts` wpisuje w niego sześćdziesiąt pierwszych znaków zlecenia,
 *     czyli zdanie, które napisał człowiek. To samo dotyczy `blocked.description` —
 *     opisuje je model własnymi słowami, z treści zlecenia. Zestawienie mówi więc,
 *     ile razy padła KTÓRA zdolność, i nigdy, do czego była potrzebna.
 *
 *  2. LICZYMY ZDARZENIA, NIE ZDANIA. Porażka kroku to `tool_end` z `ok:false`, a nie to,
 *     co model o niej napisał w odpowiedzi.
 *
 *  3. POWÓD JEST WARTOŚCIĄ ze skończonej listy. Zdanie dobiera ekran, w swoim języku —
 *     inaczej przełożony patrzący po angielsku dostałby polszczyznę utrwaloną w bazie.
 *
 * DLACZEGO BEZ WŁASNYCH INDEKSÓW. `event_cost_idx` powstał, bo dzienny limit pyta
 * o zdarzenia kosztu PRZED KAŻDYM zleceniem, więc jego brak kosztowałby każdą turę
 * każdej osoby. To zestawienie otwiera jeden człowiek i to rzadko — indeks obciążałby
 * zapis wszystkich, żeby przyspieszyć odczyt jednego. Gdy ekran zacznie być wolny,
 * będzie to widać w nim, a nie w pracy pani Basi.
 */

/**
 * OKNO ZESTAWIENIA. Bez niego liczby są sumą od początku wdrożenia — czyli po pół roku
 * nie zmieniają się już po żadnej naprawie i przestają cokolwiek znaczyć.
 */
export const WINDOW_DAYS = 30

/** Sprawy, które SIĘ SKOŃCZYŁY — tylko one wchodzą do rachunku „ile kończy się wynikiem". */
const SETTLED: readonly CaseStatus[] = ["done", "failed", "stopped"]

/** Skończyła się WYNIKIEM. Reszta stanów skończonych to porażka albo przerwanie. */
const WITH_RESULT: readonly CaseStatus[] = ["done"]

/**
 * ILE PROCENT ZAKOŃCZONYCH ZLECEŃ SKOŃCZYŁO SIĘ WYNIKIEM.
 *
 * `null`, a nie zero, gdy w oknie nie skończyła się ANI JEDNA sprawa. Zero czytałoby się
 * jako „wszystko pada" — czyli dokładnie odwrotnie niż „nie ma czego mierzyć" — i to na
 * ekranie, którym ktoś odpowiada szefowi na pytanie, czy to narzędzie działa.
 *
 * W mianowniku stoją WYŁĄCZNIE sprawy zakończone. Sprawa w toku nie jest ani sukcesem,
 * ani porażką, a wliczona obniżałaby wynik tym mocniej, im więcej pracy trwa akurat
 * w chwili patrzenia — czyli liczba spadałaby w godzinach największego użycia.
 */
export function resultShare(cases: CaseCount[]): number | null {
  const settled = cases.filter((row) => SETTLED.includes(row.status))
  const total = settled.reduce((sum, row) => sum + row.cases, 0)
  if (total === 0) return null
  const good = settled
    .filter((row) => WITH_RESULT.includes(row.status))
    .reduce((sum, row) => sum + row.cases, 0)
  return Math.round((good / total) * 100)
}

/**
 * KOSZT ROZBITY NA TEN, KTÓRY COŚ PRZYNIÓSŁ, I TEN, KTÓRY NIE.
 *
 * To jest cała odpowiedź na „czy warto płacić". Sama suma nie mówi nic, bo nie odróżnia
 * pieniędzy wydanych na pracę od pieniędzy wydanych na powtarzanie tego samego.
 *
 * Praca W TOKU stoi osobno, a nie po stronie strat: jeszcze nie wiadomo, czym się
 * skończy, a doliczenie jej do „bez wyniku" kazałoby ekranowi kłamać tym bardziej,
 * im więcej się właśnie dzieje.
 */
export function splitCost(rows: { status: CaseStatus; usd: number }[]): CostSplit {
  const sum = (which: (status: CaseStatus) => boolean) =>
    rows.filter((row) => which(row.status)).reduce((total, row) => total + row.usd, 0)
  return {
    withResult: sum((status) => WITH_RESULT.includes(status)),
    withoutResult: sum((status) => SETTLED.includes(status) && !WITH_RESULT.includes(status)),
    unfinished: sum((status) => !SETTLED.includes(status)),
  }
}

/** Okno jako parametr zapytania. Postgres składa interwał z napisu, nie z liczby. */
const sinceDays = (days: number) => String(Math.max(1, Math.round(days)))

/**
 * ILE SPRAW SKOŃCZYŁO SIĘ CZYM.
 *
 * Oknem rządzi `updated_at`, bo to ono mówi, KIEDY sprawa doszła do dzisiejszego stanu.
 * Po `created_at` sprawa założona przed oknem i domknięta wczoraj wypadałaby z rachunku,
 * choć jej wynik jest świeży — a właśnie o świeży wynik pyta ten ekran.
 */
export async function caseTally(days = WINDOW_DAYS): Promise<CaseCount[]> {
  await migrate()
  const r = await pool.query<{ status: CaseStatus; cases: string }>(
    `select status, count(*)::text as cases
       from desk.case_file
      where updated_at >= now() - ($1 || ' days')::interval
      group by status`,
    [sinceDays(days)],
  )
  return r.rows.map((row) => ({ status: row.status, cases: Number(row.cases) }))
}

/** Same porażki — liczba do plakietki przy zakładce, bez ładowania całego zestawienia. */
export async function failedCaseCount(days = WINDOW_DAYS): Promise<number> {
  await migrate()
  // Wyłącznie `failed`. Przerwanie na życzenie człowieka nie jest porażką narzędzia,
  // a plakietka, która by je liczyła, alarmowałaby przełożonego za każdym razem, gdy
  // ktoś rozmyślił się w połowie zlecenia.
  const r = await pool.query<{ cases: string }>(
    `select count(*)::text as cases
       from desk.case_file
      where status='failed' and updated_at >= now() - ($1 || ' days')::interval`,
    [sinceDays(days)],
  )
  return Number(r.rows[0]?.cases ?? 0)
}

/**
 * DLACZEGO SPRAWY BYŁY PRZERYWANE — i wyłącznie przerywane.
 *
 * DLACZEGO NIE MA TU AWARII, choć `failed` też ma wypełnioną kolumnę `reason`. Ta kolumna
 * trzyma DWA różne rodzaje wartości i to rozróżnienie jest tu całą treścią (patrz
 * `reasonText` w `desk-ui/lib`): przerwanie zapisuje KOD ze skończonej listy
 * (`stopped-by-you`, `server-restart`), a awaria — ZDANIE ułożone przez `readableFailure`
 * z treści błędu. Grupowanie zdań dałoby listę tak długą, jak liczba wariantów zdania,
 * i to po polsku także wtedy, gdy przełożony patrzy po angielsku.
 *
 * Awarie są więc LICZONE (w zestawieniu stanów), a to, co się w nich psuje, czytamy
 * ze zdarzeń kroków — czyli stamtąd, gdzie powód naprawdę jest wartością.
 */
export async function stopReasons(days = WINDOW_DAYS): Promise<StopCount[]> {
  await migrate()
  const r = await pool.query<{ reason: string; cases: string }>(
    `select coalesce(reason, '') as reason, count(*)::text as cases
       from desk.case_file
      where status='stopped' and updated_at >= now() - ($1 || ' days')::interval
      group by 1
      order by count(*) desc, 1`,
    [sinceDays(days)],
  )
  return r.rows.map((row) => ({ reason: row.reason, cases: Number(row.cases) }))
}

/**
 * CO SIĘ PSUJE — nieudane czynności agenta, po powodzie.
 *
 * Dowodem jest ZDARZENIE: `tool_end` z `ok:false`. Nie tekst modelu, nie stan sprawy —
 * tura potrafi skończyć się powodzeniem mimo trzech przewróconych kroków po drodze,
 * więc liczenie po stanie sprawy przemilczałoby właśnie te, które da się naprawić.
 *
 * ZWINIĘCIE NIEZNANEGO POWODU ROBI SQL, a nie kod nad nim, i to nie jest sprytność:
 * `count(distinct case_id)` musi policzyć sprawy PO zwinięciu. Zsumowanie dwóch takich
 * liczb w JavaScripcie policzyłoby dwa razy sprawę, która ma i krok bez powodu, i krok
 * z powodem `unknown`. Skończona lista jedzie parametrem, więc dalej jest jedna, w TypeScripcie.
 */
export async function failedSteps(days = WINDOW_DAYS): Promise<StepFailureCount[]> {
  await migrate()
  const r = await pool.query<{ reason: string; times: string; cases: string }>(
    `select case when e.payload->>'reason' = any($2::text[])
                 then e.payload->>'reason' else 'unknown' end as reason,
            count(*)::text as times,
            count(distinct e.case_id)::text as cases
       from desk.event e
      where e.payload->>'type' = 'tool_end'
        and e.payload->>'ok' = 'false'
        and e.at >= now() - ($1 || ' days')::interval
      group by 1
      order by count(*) desc, 1`,
    [sinceDays(days), [...STEP_FAILURES]],
  )
  return r.rows.map((row) => ({
    reason: row.reason as StepFailureCount["reason"],
    times: Number(row.times),
    cases: Number(row.cases),
  }))
}

/**
 * CZEGO LUDZIOM BRAKUJE — kłódki po zdolnościach.
 *
 * Najcenniejszy wiersz tego ekranu: zdolność, na którą ktoś naprawdę wpadł w pracy,
 * razem z tym, ilu ludzi na nią wpadło. Przełożony ma z tego JEDNĄ decyzję do podjęcia —
 * włączyć albo nie — a nie kolejną tabelę do oglądania.
 *
 * IMION TU NIE MA i to jest reguła, nie oszczędność. Sprawa jest prywatna, a „Anna
 * potrzebowała sprawdzenia kontrahenta" mówi o treści jej pracy. Kto poprosił o dostęp
 * WPROST, stoi w „Do decyzji" — bo tam człowiek sam się o to upomniał.
 *
 * `capabilityId` pusty znaczy: agent zgłosił brak czynności, której katalog w ogóle nie
 * zna. To jest sygnał o dziurze w katalogu, a nie o czyimś braku uprawnień, więc ekran
 * musi go nazwać inaczej — stąd `null`, a nie zlanie z resztą.
 *
 * I dlatego ten wiersz idzie NA KONIEC, choćby był najliczniejszy. Blok obiecuje, że
 * każdy wiersz to zdolność, którą da się komuś włączyć — a tego akurat włączyć się nie
 * da, bo jej nie ma. Zmierzone na żywych danych: stał pierwszy, z 39 trafieniami, nad
 * dwiema zdolnościami, na które przełożony naprawdę mógł coś zrobić.
 */
export async function missingCapabilities(days = WINDOW_DAYS): Promise<MissingCapabilityCount[]> {
  await migrate()
  const r = await pool.query<{ capability: string; times: string; people: string }>(
    `select coalesce(e.payload->>'capabilityId', '') as capability,
            count(*)::text as times,
            count(distinct c.owner)::text as people
       from desk.event e
       join desk.case_file c on c.id = e.case_id
      where e.payload->>'type' = 'blocked'
        and e.at >= now() - ($1 || ' days')::interval
      group by 1
      order by (coalesce(e.payload->>'capabilityId', '') = '') asc, count(*) desc, 1`,
    [sinceDays(days)],
  )
  return r.rows.map((row) => ({
    capabilityId: row.capability === "" ? null : row.capability,
    times: Number(row.times),
    people: Number(row.people),
  }))
}

/**
 * ILE KOSZTOWAŁA PRACA O KAŻDYM ZAKOŃCZENIU.
 *
 * Liczymy ZDARZENIA KOSZTU z okna, a nie `case_file.cost_usd`, i to jest ta sama pomyłka,
 * którą naprawiono w `spentToday`: `cost_usd` jest sumą CAŁEGO życia sprawy, więc sprawa
 * sprzed pół roku, dotknięta wczoraj jednym zdaniem, wniosłaby do okna cały swój
 * historyczny koszt. Zdarzenie kosztu niesie własny znacznik czasu.
 *
 * Stan bierzemy DZISIEJSZY, bo pytanie brzmi „na co poszły te pieniądze", a odpowiedź
 * na nie zna się dopiero po zakończeniu sprawy.
 */
export async function costByStatus(days = WINDOW_DAYS): Promise<{ status: CaseStatus; usd: number }[]> {
  await migrate()
  const r = await pool.query<{ status: CaseStatus; usd: string }>(
    `select c.status, coalesce(sum((e.payload->>'usd')::numeric), 0)::text as usd
       from desk.event e
       join desk.case_file c on c.id = e.case_id
      where e.payload->>'type' = 'cost'
        and e.at >= now() - ($1 || ' days')::interval
      group by c.status`,
    [sinceDays(days)],
  )
  return r.rows.map((row) => ({ status: row.status, usd: Number(row.usd) }))
}

/** Całe zestawienie jednym wejściem — pięć tanich zapytań zbiorczych, równolegle. */
export async function outcomes(days = WINDOW_DAYS): Promise<Outcomes> {
  const [cases, stops, steps, missing, cost] = await Promise.all([
    caseTally(days),
    stopReasons(days),
    failedSteps(days),
    missingCapabilities(days),
    costByStatus(days),
  ])
  return {
    days,
    cases,
    resultShare: resultShare(cases),
    stops,
    steps,
    missing,
    cost: splitCost(cost),
  }
}
