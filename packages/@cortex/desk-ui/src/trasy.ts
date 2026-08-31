/**
 * Biurko stoi albo pod korzeniem (aplikacja samodzielna), albo pod prefiksem
 * (kafelek w powłoce Cortexa). Adresy nie mogą być więc wpisane na sztywno
 * w dwudziestu miejscach — to jedyna rzecz, która różni te dwa wcielenia.
 *
 * `NEXT_PUBLIC_`, bo prefiks musi być znany także w przeglądarce: linki i `fetch`
 * z komponentów klienckich składają się tam, nie na serwerze.
 */
export const BAZA = process.env.NEXT_PUBLIC_DESK_BAZA ?? ''

/** Adres strony Biurka. `t('/pliki')` → `/pliki` albo `/desk/pliki`. */
export const t = (sciezka: string) => `${BAZA}${sciezka}` || '/'

/** Adres trasy API Biurka. `api('/pliki')` → `/api/pliki` albo `/desk/api/pliki`. */
export const api = (sciezka: string) => `${BAZA}/api${sciezka}`
