---
name: code-api
description: Wzorzec BFF route (Next.js API route handler) w cortex-frontend — kontroler HTTP, cienki, deleguje do code-service i code-integration. Użyj przy pisaniu/review dowolnego pliku app/api/**/route.ts. NIE dla logiki biznesowej/RBAC (→ code-service) ani dla wywołań serwisów spoza repo (→ code-integration).
---

# code-api

## Rola

Route handler = **kontroler**, w duchu .NET: parse → auth → deleguj → odpowiedz. Zero logiki biznesowej, zero budowania payloadów do zewnętrznych API bezpośrednio tutaj — to należy do `code-service`/`code-integration`.

## Szkielet (wzorzec, nie kopiuj 1:1 — patrz "znany dług" niżej)

```ts
export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 })

  const access = await requireTileAccess(request, entitlementCode) // @cortex/service
  if (!access.allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const result = await callIntegration(parsed.data) // @cortex/service lub lokalny adapter code-integration
  return NextResponse.json(result)
}
```

## Referencyjna, działająca implementacja (do inspiracji)

`app/idp/app/api/ai-tools/generate/route.ts` — realne wywołanie cortex-proxy, walidacja Zod, auth+authz, zapis historii, testowane (`route.test.ts`). Dobry przykład kontraktu request/response i obsługi błędów (`502` na błąd upstream, `403` na brak uprawnień, `400` na zły request).

## Znany dług w tej implementacji — nie powielaj

`generate/route.ts` dziś miesza kontroler + auth + adapter integracyjny (budowanie payloadu OpenRouter vs OpenAI-style, heurystyki per-model) w jednym pliku — więcej niż "thin proxy". Do wydzielenia: logika budowania payloadu/wywołania cortex-proxy → osobny plik w `code-integration` (np. `lib/ai-tools/cortex-proxy-client.ts`). Nowe route'y pisz od razu z tym podziałem, nie kopiuj obecny plik 1:1.

## Reguły

- Walidacja wejścia zawsze przez Zod, `safeParse`, nigdy `parse()` bez try/catch.
- Auth zawsze pierwsza (przed jakąkolwiek pracą) — `requireTileAccess()`.
- Żadnego `fetch()` do zewnętrznego hosta bezpośrednio w route — przez adapter `code-integration`.
- Kody błędów: `400` zły request, `401` brak tożsamości, `403` brak uprawnień, `502` błąd upstreamu, `501` niezaimplementowane (dozwolone tylko w szkielecie ze `pnpm gen tile`, nie w mergowanym kodzie).
