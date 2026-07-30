// Agregacja modelu widoku raportu tokenów — CZYSTE funkcje: zero HTTP, zero
// bazy, zero JSX. Wołane server-side z BFF, żeby surowa odpowiedź /usage
// (e-maile wszystkich użytkowników, nazwy wewnętrznych integracji) nigdy nie
// dotarła do przeglądarki w całości.
//
// Dane wejściowe są JUŻ zagregowane po stronie proxy (GROUP BY user_id,
// source_app, scope, model), więc tutaj nie liczymy niczego od zera —
// sumujemy gotowe wiersze po wybranym wymiarze.
//
// ── Trzy świadome różnice względem zepsutego oryginału (cortex-admin/token_usage.py)
//
// 1. reasoning_tokens SĄ agregowane. process_usage_data() ich nie czyta, więc
//    wypadały z raportu — przy modelach reasoningowych to realna dziura
//    (w lokalnej bazie: 4063 tokeny reasoningu na 54003 łącznie).
// 2. Normalizowane są OBA warianty pustych wymiarów, nie tylko pusty string.
//    Schemat SQLite ma DEFAULT '' (stare wiersze), a dzisiejszy logMiddleware
//    wpisuje "unknown"/"default" (proxy.go:186-197). Streamlit widzi tylko
//    pierwszy wariant i pokazuje "unknown" jako zwyczajną nazwę aplikacji.
// 3. Pusty zbiór danych przechodzi przez wszystkie ścieżki bez wyjątku.
//    Oryginał wywala się NameError-em na pustym scope_stats (linia z col5).
//
// ── Dlaczego rankingi idą po total_tokens, a nie po request+response
//
// Streamlit rekonstruował sumę jako request_tokens + response_tokens.
// total_tokens z proxy jest wartością AUTORYTATYWNĄ: gdy dostawca poda własną
// sumę, proxy zapisuje ją bez zmian, a dolicza składniki tylko gdy dostawca
// sumy nie dał (proxy.go:515-518, 534-535). Doklejenie do tego reasoning_tokens
// podwójnie liczyłoby modele, u których reasoning siedzi już w completion.
// Dlatego: total_tokens rządzi rankingiem i udziałami, a request/response/
// reasoning/cached są pokazywane obok jako rozbicie informacyjne.

export interface ProxyUsageRow {
  user_id: string
  source_app: string
  scope: string
  model: string
  request_tokens: number
  response_tokens: number
  reasoning_tokens: number
  cached_tokens: number
  total_tokens: number
  request_count: number
}

export interface UsageDetailRow {
  user: string
  app: string
  scope: string
  model: string
  requestTokens: number
  responseTokens: number
  reasoningTokens: number
  cachedTokens: number
  totalTokens: number
  requestCount: number
}

export interface UsageGroup {
  key: string
  totalTokens: number
  requestTokens: number
  responseTokens: number
  reasoningTokens: number
  cachedTokens: number
  requestCount: number
  /** Ilu różnych użytkowników złożyło się na tę pozycję. Dla wymiaru
   *  "użytkownik" zawsze 1 — pole zostaje dla jednolitego kształtu. */
  userCount: number
  /** Udział w sumie tokenów, 0..100. Przy zerowej sumie: 0, nigdy NaN. */
  share: number
}

export interface UsageTotals {
  totalTokens: number
  requestTokens: number
  responseTokens: number
  reasoningTokens: number
  cachedTokens: number
  requestCount: number
  /** Użytkownicy widoczni w danych, także ci z zerowym zużyciem. */
  userCount: number
  /** Użytkownicy z total_tokens > 0 — definicja z oryginału. */
  activeUsers: number
  /** Średnia liczona po AKTYWNYCH, nie po wszystkich (jak w oryginale). */
  averageTokensPerActiveUser: number
  modelCount: number
  appCount: number
  scopeCount: number
  topModel: string | null
  topApp: string | null
  topScope: string | null
}

export interface UsageReport {
  totals: UsageTotals
  byUser: UsageGroup[]
  byModel: UsageGroup[]
  byApp: UsageGroup[]
  byScope: UsageGroup[]
  rows: UsageDetailRow[]
}

/** Etykiety zastępcze. Świadomie w nawiasach — mają się NIE mylić z realną
 *  nazwą aplikacji o nazwie "unknown", którą ktoś mógłby wysłać naprawdę. */
export const UNKNOWN_USER_LABEL = "(nieznany)"
export const UNKNOWN_APP_LABEL = "(nieznana aplikacja)"
export const DEFAULT_SCOPE_LABEL = "(domyślny)"
export const UNKNOWN_MODEL_LABEL = "(nieznany model)"

/**
 * Wymiar "użytkownik". Proxy wpisuje "unknown", gdy w kontekście nie ma
 * tożsamości (proxy.go:186), a stare wiersze mają pusty string ze schematu.
 *
 * "anonymous" celowo NIE jest tu zwijane: to inna ścieżka kodu w proxy,
 * oznaczająca jawnie anonimowego wołającego, a nie brak informacji. Zlanie
 * ich w jedno zniszczyłoby rozróżnienie, którego z powrotem nie da się odzyskać.
 *
 * Kolumna nazywa się "Użytkownik", nie "E-mail" — X-User-ID to dowolny string
 * od dowolnego z kilkunastu konsumentów proxy, nie gwarantowany adres.
 */
export function normalizeUser(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed === "unknown") return UNKNOWN_USER_LABEL
  return trimmed
}

export function normalizeApp(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed === "unknown") return UNKNOWN_APP_LABEL
  return trimmed
}

export function normalizeScope(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed === "default") return DEFAULT_SCOPE_LABEL
  return trimmed
}

export function normalizeModel(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "" || trimmed === "unknown") return UNKNOWN_MODEL_LABEL
  return trimmed
}

interface Counters {
  requestTokens: number
  responseTokens: number
  reasoningTokens: number
  cachedTokens: number
  totalTokens: number
  requestCount: number
}

function emptyCounters(): Counters {
  return {
    requestTokens: 0,
    responseTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    requestCount: 0,
  }
}

/** Ujemne/NaN-owe liczniki nie powinny wyjść z Go, ale model widoku ma być
 *  odporny na śmieci z cudzego serwisu — inaczej jeden zły wiersz rozjeżdża
 *  wszystkie udziały procentowe. */
function toCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function addRow(target: Counters, row: ProxyUsageRow): void {
  target.requestTokens += toCount(row.request_tokens)
  target.responseTokens += toCount(row.response_tokens)
  target.reasoningTokens += toCount(row.reasoning_tokens)
  target.cachedTokens += toCount(row.cached_tokens)
  target.totalTokens += toCount(row.total_tokens)
  target.requestCount += toCount(row.request_count)
}

/** Malejąco po tokenach, przy remisie alfabetycznie po kluczu. Tie-break nie
 *  jest kosmetyką: bez niego kolejność zależałaby od kolejności wierszy z
 *  SQLite, a eksport CSV i testy przestałyby być powtarzalne. */
function byTokensDesc(a: UsageGroup, b: UsageGroup): number {
  if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens
  return a.key.localeCompare(b.key, "pl")
}

function groupBy(
  rows: readonly ProxyUsageRow[],
  keyOf: (row: ProxyUsageRow) => string,
  grandTotal: number,
): UsageGroup[] {
  const buckets = new Map<string, Counters & { users: Set<string> }>()

  for (const row of rows) {
    const key = keyOf(row)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { ...emptyCounters(), users: new Set<string>() }
      buckets.set(key, bucket)
    }
    addRow(bucket, row)
    bucket.users.add(normalizeUser(row.user_id))
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      requestTokens: bucket.requestTokens,
      responseTokens: bucket.responseTokens,
      reasoningTokens: bucket.reasoningTokens,
      cachedTokens: bucket.cachedTokens,
      totalTokens: bucket.totalTokens,
      requestCount: bucket.requestCount,
      userCount: bucket.users.size,
      share: grandTotal > 0 ? (bucket.totalTokens / grandTotal) * 100 : 0,
    }))
    .sort(byTokensDesc)
}

/**
 * Wiersze szczegółowe są RE-AGREGOWANE po normalizacji, nie mapowane 1:1.
 * Proxy grupuje po surowych wartościach, więc wiersz z source_app="" i wiersz
 * z source_app="unknown" przychodzą osobno, a po normalizacji mają identyczny
 * klucz. Bez ponownego zsumowania tabela szczegółowa pokazywałaby dwa wizualnie
 * nierozróżnialne wiersze o tych samych czterech wymiarach.
 */
function buildDetailRows(rows: readonly ProxyUsageRow[]): UsageDetailRow[] {
  const buckets = new Map<string, UsageDetailRow>()

  for (const row of rows) {
    const user = normalizeUser(row.user_id)
    const app = normalizeApp(row.source_app)
    const scope = normalizeScope(row.scope)
    const model = normalizeModel(row.model)
    // JSON.stringify, nie join(separator): każdy separator, który wybierzemy,
    // może teoretycznie wystąpić w danych (source_app i scope to dowolne
    // stringi z nagłówków), a wtedy ("a b","c") i ("a","b c") dają ten sam
    // klucz i dwa różne wiersze cicho zlewają się w jeden. Cudzysłowy i
    // escapowanie z JSON-a robią tę granicę jednoznaczną.
    const key = JSON.stringify([user, app, scope, model])

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { user, app, scope, model, ...emptyCounters() }
      buckets.set(key, bucket)
    }
    addRow(bucket, row)
  }

  return [...buckets.values()].sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens
    return (
      a.user.localeCompare(b.user, "pl") ||
      a.app.localeCompare(b.app, "pl") ||
      a.scope.localeCompare(b.scope, "pl") ||
      a.model.localeCompare(b.model, "pl")
    )
  })
}

export function buildUsageReport(rows: readonly ProxyUsageRow[]): UsageReport {
  const grand = emptyCounters()
  for (const row of rows) addRow(grand, row)

  const byUser = groupBy(rows, (row) => normalizeUser(row.user_id), grand.totalTokens)
  const byModel = groupBy(rows, (row) => normalizeModel(row.model), grand.totalTokens)
  const byApp = groupBy(rows, (row) => normalizeApp(row.source_app), grand.totalTokens)
  const byScope = groupBy(rows, (row) => normalizeScope(row.scope), grand.totalTokens)

  const activeUsers = byUser.filter((user) => user.totalTokens > 0).length

  return {
    totals: {
      ...grand,
      userCount: byUser.length,
      activeUsers,
      averageTokensPerActiveUser: activeUsers > 0 ? grand.totalTokens / activeUsers : 0,
      modelCount: byModel.length,
      appCount: byApp.length,
      scopeCount: byScope.length,
      topModel: byModel[0]?.key ?? null,
      topApp: byApp[0]?.key ?? null,
      topScope: byScope[0]?.key ?? null,
    },
    byUser,
    byModel,
    byApp,
    byScope,
    rows: buildDetailRows(rows),
  }
}
