"use client"

import { useQuery } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { UsageDateRange } from "./types"

/**
 * Raport za wybrany zakres. Cache po stronie klienta zastępuje `st.session_state`
 * z oryginału, a `refetch()` odpowiada tamtejszemu przyciskowi "Wyczyść cache".
 *
 * Cache SERWEROWEGO świadomie nie ma: to widok read-only nad cudzymi danymi
 * aktualizowanymi na żywo, a każdy zapis po naszej stronie byłby drugim
 * źródłem prawdy o zużyciu.
 */
export function useTokenUsageReport(range: UsageDateRange, enabled = true) {
  return useQuery({
    queryKey: queryKeys.report(range),
    queryFn: () => endpoints.report(range),
    enabled,
    // Raport za zamknięty okres nie zmienia się z sekundy na sekundę, a każde
    // odświeżenie to zapytanie do cudzego serwisu produkcyjnego.
    staleTime: 60_000,
  })
}
