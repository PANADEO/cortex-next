/**
 * Biurko stoi albo pod korzeniem (aplikacja samodzielna), albo pod prefiksem
 * (kafelek w powłoce Cortexa). Adresy nie mogą być więc wpisane na sztywno
 * w dwudziestu miejscach — to jedyna rzecz, która różni te dwa wcielenia.
 *
 * `NEXT_PUBLIC_`, bo prefiks musi być znany także w przeglądarce: linki i `fetch`
 * z komponentów klienckich składają się tam, nie na serwerze.
 */
export const BASE = process.env.NEXT_PUBLIC_DESK_BASE_PATH ?? ""

/**
 * Prefiks tras API jest OSOBNY, a nie sklejany z prefiksu stron, bo w powłoce
 * te dwa drzewa rozchodzą się: strony kafelka stoją pod `/desk`, a jego trasy
 * pod `/api/desk` — Next trzyma `app/api` w jednym miejscu dla całej aplikacji
 * i nie ma tam grupy tras, która przeniosłaby je pod kafelek.
 */
export const API_BASE = process.env.NEXT_PUBLIC_DESK_API_BASE_PATH ?? `${BASE}/api`

/**
 * Adres strony Biurka. `t('/files')` → `/files` albo `/desk/files`.
 *
 * Ogon `/` obcinamy, bo `t("/")` pod prefiksem dawało `/desk/` — adres poprawny,
 * ale NIE równy temu, co zwraca `usePathname()` (`/desk`). Porównanie „czy
 * jestem na tej zakładce" wychodziło wtedy fałszywe i pasek dolny nie
 * podświetlał nigdy pierwszej pozycji.
 */
export const t = (path: string) => `${BASE}${path}`.replace(/\/$/, "") || "/"

/** Adres trasy API Biurka. `api('/files')` → `/api/files` albo `/api/desk/files`. */
export const api = (path: string) => `${API_BASE}${path}`
