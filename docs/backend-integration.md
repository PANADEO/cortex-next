# Backend Integration — MSW Carve-Out Pattern

> **Do not modify this file unless explicitly requested by user.**

Ten dokument opisuje **jak stopniowo podpinać frontend do prawdziwego backendu IDP**, zachowując MSW jako fallback dla reszty endpointów. Inna nazwa tego patternu: "partial backend swap".

## Cel

Architektura (`docs/frontend-architecture.md`) zakłada, że przełączenie z MSW na prod API to flip jednej flagi. W praktyce — gdy backend nie ma wszystkich endpointów, których oczekuje frontend — chcemy **hybryde**:

- Wybrane endpointy → real backend IDP
- Reszta → MSW mocki (żeby reszta apki dalej klikała)

To pozwala podpinać endpoint po endpoincie, weryfikować kontrakt, a demo dalej działa.

## Tryby operacyjne

| Tryb | `NEXT_PUBLIC_API_MOCKING` | `IDP_BACKEND_URL` | `rewrites()` | Efekt |
|---|---|---|---|---|
| **Pełny mock** (default dev) | `enabled` | — | pusty | Wszystko przez MSW, frontend standalone |
| **Pełny prod** | `disabled` | same-origin (za Caddy) | pusty | Wszystko leci do real API (Caddy forwarduje) |
| **Partial carve-out** | `enabled` | `http://localhost:8000` | lista endpointów | Hybrid — wybrane endpointy real, reszta mock |

## Pattern — 3 składniki

Carve-out pojedynczego endpointu wymaga trzech skoordynowanych zmian. Pominięcie dowolnego z nich daje `404` albo niechciany fallback.

### 1. `app/idp/mocks/handlers.ts` — MSW passthrough

```ts
import { http, HttpResponse, passthrough } from "msw"

export const handlers = [
  // MSW carve-out: passthrough MUSI być PRZED dynamicznymi handlerami (np. /packages/:id),
  // które inaczej łapią konkretne paths.
  http.get("/user/me", () => passthrough()),
  http.get("/packages/dashboard-stats", () => passthrough()),

  // ... reszta handlerów mocków
]
```

**Dlaczego explicit passthrough, nie brak handlera?**
MSW handler `http.get("/packages/:id", ...)` w tablicy łapie **każdy** path matching `/packages/<cokolwiek>`, w tym `/packages/dashboard-stats`. Sam brak handlera nie wystarczy — trzeba explicit passthrough z wyższym priorytetem.

### 2. `app/idp/next.config.ts` — rewrites z `beforeFiles`

```ts
const IDP_BACKEND_URL = process.env.IDP_BACKEND_URL ?? "http://localhost:8000"

const nextConfig: NextConfig = {
  // ... reszta konfiguracji
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/user/me",                  destination: `${IDP_BACKEND_URL}/user/me` },
        { source: "/packages/dashboard-stats", destination: `${IDP_BACKEND_URL}/packages/dashboard-stats` },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
```

**Dlaczego `beforeFiles`, nie default (afterFiles)?**
Jeśli path matchuje istniejący Next route (np. `/packages/dashboard-stats` łapie się z dynamic `/packages/[id]`), `afterFiles` nigdy nie zadziała. `beforeFiles` rewrites działają **przed** routingiem aplikacyjnym.

### 3. `app/idp/.env.local` — server-side URL

```bash
NEXT_PUBLIC_API_MOCKING=enabled
IDP_BACKEND_URL=http://localhost:8000
# Celowo BEZ NEXT_PUBLIC_API_BASE_URL — apiClient zostaje na relative URLs (same-origin).
```

**Dlaczego `IDP_BACKEND_URL` zamiast `NEXT_PUBLIC_API_BASE_URL`?**
`NEXT_PUBLIC_*` jest eksponowane do klienta i używane przez `apiClient.baseUrl`. Ustawienie go na `http://localhost:8000` powoduje, że **wszystkie** fetche idą cross-origin, MSW przestaje interceptować (nie działa cross-origin), i MSW mocks się wyłączają globalnie. Używamy server-side-only env var (`IDP_BACKEND_URL`), żeby sterować rewritem bez łamania MSW.

## Przepływ requestu

```
Browser: apiClient.get("/packages/dashboard-stats")
      ↓ fetch (relative, same-origin)
[MSW service worker intercepcja]
      ↓ handler zwraca passthrough()
      ↓ request leci dalej same-origin
[Next dev server :3000]
      ↓ middleware auth check → NextResponse.next()
      ↓ rewrites.beforeFiles match → server-side fetch
[IDP FastAPI :8000]
      ↓ middleware: X-Auth-Request-Email
      ↓ response {in_queue: 0, ...}
      ↑ returns through Next → browser
React Query → cache → component render
```

Dla endpointów bez carve-out (np. `/packages/get_all`):

```
Browser: apiClient.get("/packages/get_all")
      ↓ fetch (relative, same-origin)
[MSW] → matching handler → mock response → browser
```

## Dodanie nowego endpointu do carve-out — checklist

1. Dodaj **pierwszy** w tablicy `handlers` (przed dynamic routes z tego samego prefixa):
   ```ts
   http.get("/your/endpoint", () => passthrough()),
   ```
2. Dodaj do `beforeFiles` w `next.config.ts`:
   ```ts
   { source: "/your/endpoint", destination: `${IDP_BACKEND_URL}/your/endpoint` },
   ```
3. **Restart** `npm run dev` — zmiany w `next.config.ts` nie reloadują przez HMR.
4. Zweryfikuj w DevTools Network: request na `http://localhost:3000/your/endpoint` → `200` z danymi z backendu (nie z MSW).
5. Sprawdź że reszta apki dalej klikana (inne ekrany dostają mocki z MSW).

## Pułapki — trzy rzeczy, które nas tu zjadły

### Pułapka 1: MSW cross-origin nie interceptuje
Ustawienie `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` wyłącza MSW globalnie, bo service worker w browserze interceptuje tylko same-origin. Skutek: wszystko leci do backendu, missing endpoints dają 404.

**Rozwiązanie:** zostawić `apiClient.baseUrl` puste (same-origin), sterować rewrite'em przez server-side env (`IDP_BACKEND_URL`).

### Pułapka 2: Next `afterFiles` przegrywa z dynamic route
`rewrites()` zwracające tablicę to `afterFiles` — aplikują się po routingu. Path `/packages/dashboard-stats` matchuje `/packages/[id]`, który istnieje → rewrite nigdy nie zadziała.

**Rozwiązanie:** `beforeFiles`.

### Pułapka 3: MSW dynamic handler łapie konkretne paths
`http.get("/packages/:id", ...)` łapie `/packages/dashboard-stats` i zwraca `PACKAGE_NOT_FOUND` (bo nie istnieje paczka o takim id). Request nigdy nie opuszcza MSW, rewrite nie ma szans zadziałać.

**Rozwiązanie:** explicit `passthrough()` handler **na początku** tablicy handlerów.

## Kiedy przełączyć się na "pełny prod"

Gdy backend ma wszystkie endpointy, których oczekuje frontend (zobacz `documentation/integration-audit/backend-idp.md §10` — macierz dopasowania), można:

1. Ustawić `NEXT_PUBLIC_API_MOCKING=disabled`
2. Ustawić `NEXT_PUBLIC_API_BASE_URL=<prod-url>` (lub zostawić same-origin za Caddy)
3. Usunąć `rewrites()` z `next.config.ts`
4. Usunąć passthrough handlery z `handlers.ts`

MSW zostaje dostępne dla testów unit/integration (Vitest + MSW w Node) — nie usuwamy zależności.

## Powiązane dokumenty

- **`docs/frontend-architecture.md`** — decyzja stackowa (sekcja "Mocking API: MSW")
- **`architecture_rules.md` §8** — API layer rules
- **`../documentation/integration-audit/backend-idp.md`** (parent repo) — katalog endpointów backendu + macierz rozjazdów
- **`../documentation/integration-audit/frontend-consumer.md`** (parent repo) — co frontend oczekuje
