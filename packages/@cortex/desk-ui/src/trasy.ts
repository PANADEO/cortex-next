/**
 * Biurko stoi albo pod korzeniem (aplikacja samodzielna), albo pod prefiksem
 * (kafelek w powłoce Cortexa). Adresy nie mogą być więc wpisane na sztywno
 * w dwudziestu miejscach — to jedyna rzecz, która różni te dwa wcielenia.
 *
 * `NEXT_PUBLIC_`, bo prefiks musi być znany także w przeglądarce: linki i `fetch`
 * z komponentów klienckich składają się tam, nie na serwerze.
 */
export const BAZA = process.env.NEXT_PUBLIC_DESK_BAZA ?? ''

/**
 * Prefiks tras API jest OSOBNY, a nie sklejany z prefiksu stron, bo w powłoce
 * te dwa drzewa rozchodzą się: strony kafelka stoją pod `/desk`, a jego trasy
 * pod `/api/desk` — Next trzyma `app/api` w jednym miejscu dla całej aplikacji
 * i nie ma tam grupy tras, która przeniosłaby je pod kafelek.
 */
export const BAZA_API = process.env.NEXT_PUBLIC_DESK_BAZA_API ?? `${BAZA}/api`

/** Adres strony Biurka. `t('/pliki')` → `/pliki` albo `/desk/pliki`. */
export const t = (sciezka: string) => `${BAZA}${sciezka}` || '/'

/** Adres trasy API Biurka. `api('/pliki')` → `/api/pliki` albo `/api/desk/pliki`. */
export const api = (sciezka: string) => `${BAZA_API}${sciezka}`
