---
name: code-integration
description: Wywołania NA ZEWNĄTRZ modułu — cortex-proxy, przyszłe zewnętrzne serwisy Python/FastAPI. Użyj gdy trzeba wywołać LLM albo dowolny serwis spoza tego repo. NIE dla logiki współdzielonej między kafelkami wewnątrz monolitu (→ code-service, import zamiast HTTP) ani dla samego route'a (→ code-api).
---

# code-integration

## Reguła

Każda integracja zewnętrzna (cortex-proxy dziś, przyszłe serwisy) żyje w **osobnym pliku adaptera**, nigdy inline w `code-api` route. Adapter = jedna odpowiedzialność: zbuduj payload, wywołaj, zmapuj odpowiedź/błąd. `code-api` woła adapter, nic więcej.

## cortex-proxy — referencyjny kontrakt

Nagłówki wymagane: `X-User-ID`, `X-Scope`, `X-Source-App`. Endpoint: `POST {CORTEX_PROXY_URL}/v1/chat/completions`. Dwa warianty payloadu zależnie od modelu (OpenRouter-style `prompt` string vs OpenAI-style `messages[]`) — patrz `isOpenRouterModel()`/`buildCortexPayload()` w `app/idp/app/api/ai-tools/generate/route.ts` (do wydzielenia jako osobny adapter, patrz `code-api` "znany dług").

## Zewnętrzne serwisy nie-LLM (np. Ilustromat, przyszłe Python/FastAPI)

Ten sam wzorzec: adapter w `lib/<modul>/integration-client.ts`, wywołanie przez `fetch` z jawnym timeoutem (`AbortController`, wzorem `REQUEST_TIMEOUT_MS` w `generate/route.ts`), mapowanie błędów na czytelny kod HTTP dla klienta. Nigdy nie zakładać, że zewnętrzny serwis jest zawsze dostępny — zawsze `try/catch` + jawny błąd `502`.

## Docker/sieć

Zewnętrzny serwis wywoływany przez Docker DNS na `run_default` (np. `http://cortex-proxy`), nie przez publiczny URL, jeśli oba kontenery są na tym samym hoście — patrz `code-compose`.
