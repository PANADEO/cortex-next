# Rejestr kafelków

Status: przejściowy — dwa rejestry dziś, jeden docelowo. Kontekst decyzji: Obsidian `PROJECT/cortex-frontend-tiles-roadmap-mvp.md`.

## Trzy rodzaje kafelka (`@cortex/tile-sdk`)

```ts
type TileKind = "native" | "external-link" | "iframe"
```

`native` — strona w tym appie. `external-link` — link/`target=_blank"` do zewnętrznego serwisu (dziś: OpenWebUI). `iframe` — jak wyżej, osadzone w chrome shellu (Faza 2, nieużywane jeszcze).

## Stan dziś — DWA rejestry, świadomie

1. `app/idp/lib/tiles.ts` — ogólny rejestr (`TILES` array), hardcoded w kodzie. Komentarz w pliku: kafelki `task-chat` (Cortex Cowork) NIE są tu — dochodzą z governance store w runtime.
2. `app/idp/lib/ai-tools/registry.ts` (`AI_TOOL_DEFINITIONS`) — osobny rejestr dla kafelków typu "text-tool", mapowany na `Tile` przez `aiToolTile()` w (1).

Nie konsolidować tych dwóch na siłę teraz — różne kształty danych, różne cykle życia.

## Docelowo — rejestr edytowalny z UI (wymóg Cezarego, 28.07.2026)

"Ustawianie kafelków w instancji ma być z UI, nie edycją plików." Realizacja: tabela `applications` (rozszerzona o `route`/`kind`/`url`) w schemacie `konfiguracja_systemu` (`@cortex/db`) + ekran CRUD w module Konfiguracja Systemu. Zastępuje hardcoded `tiles.ts` — nie plik `services-config.json` (to wzorzec starego `cortex-box-prototype`, świadomie porzucony).

## Ścieżka pod przyszłą samodzielność klientów (nie teraz, ale projektować z myślą o tym)

Zbadane wzorce branżowe (Shopify/Salesforce/Retool/Notion): bezpieczna droga to zewnętrzny serwis klienta + cienki kontrakt (`external-link`/`iframe`), nigdy wykonywanie cudzego kodu w naszym procesie. Rejestr kafelków projektowany TERAZ z polem `kind` już to wspiera — klient dopisujący własny kafelek to w praktyce nowy wiersz `external-link` wskazujący na jego własny, osobno hostowany serwis. Nic więcej nie trzeba budować, żeby to było możliwe w przyszłości.
