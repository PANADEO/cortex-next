---
name: code-config
description: Jak moduł deklaruje własną konfigurację (env vars, URL-e zewnętrznych backendów) — bez centralnego pliku ze wszystkimi zmiennymi. Użyj przy dodawaniu nowej zmiennej środowiskowej albo integracji z zewnętrznym serwisem.
---

# code-config

## Reguła: config współlokowany z modułem, nie scentralizowany

**Zero jednego, rosnącego pliku walidującego wszystkie zmienne środowiskowe całej appki.** Każdy moduł/pakiet, który potrzebuje configu, ma WŁASNY, mały plik `config.ts` obok swojego kodu, walidujący TYLKO to, czego on potrzebuje. `.env` (jeden plik, standard Next.js/Docker) trzyma wartości — schemat/walidacja jest rozproszona.

```ts
// packages/@cortex/db/src/config.ts
import { z } from "zod"

const schema = z.object({ DATABASE_URL: z.string().url() })
export const dbConfig = schema.parse(process.env)
```

```ts
// lib/ilustromat/config.ts (przykład przyszłej integracji)
import { z } from "zod"

const schema = z.object({
  ILUSTROMAT_SERVICE_URL: z.string().url(),
  ILUSTROMAT_API_KEY: z.string().min(1),
})
export const ilustromatConfig = schema.parse(process.env)
```

## Dlaczego nie jeden centralny loader

cortex2 ma jeden `packages/config/src/server.ts` walidujący WSZYSTKO naraz (uznane za plus audytu — fail-closed, dobre defaulty) — ale to jest dokładnie "kolos", którego chcesz uniknąć: jeden plik rośnie z każdym nowym modułem, nikt nie wie bez czytania całości, czego potrzebuje konkretny moduł, trudno testować w izolacji. **Bierzemy z cortex2 ideę** (Zod, fail-closed, sensowne defaulty, agregacja błędów przez `superRefine` gdy trzeba kilku zmiennych naraz) — **nie bierzemy centralizacji.**

## Zewnętrzne backendy — już istniejący, dobry wzorzec

`.env.example` ma dziś: `IDP_BACKEND_URL`, `IDP_BASIC_BACKEND_URL`, `INTRASTAT_BACKEND_URL`, `INVOICE_SUPERVISOR_BACKEND_URL` — osobna zmienna per backend, nie jeden wspólny obiekt. Nowa integracja (`code-integration`) idzie tym samym wzorcem: `<MODUL>_SERVICE_URL` + ewentualny `<MODUL>_API_KEY`, walidowane w `config.ts` tego modułu, nie dopisywane do wspólnej listy.

## Reguły

1. Nowa zmienna środowiskowa → nowy albo istniejący `config.ts` TEGO modułu, nigdy dopisanie do cudzego.
2. Walidacja przez Zod, fail-closed (brak/zła wartość = rzuć na starcie, nie cichy fallback do czegoś niebezpiecznego).
3. `.env`/`.env.example` mogą zawierać wszystkie zmienne w jednym pliku (to jest normalne, Next.js/Docker tego oczekują) — kolosem, którego unikamy, jest WALIDACJA/SCHEMAT, nie sam plik `.env`.
