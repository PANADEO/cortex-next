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

### Podział ról po unifikacji bramek (30.07.2026)

Rozdzielenie, o które łatwo się potknąć: **`tiles.ts` odpowiada na „jak kafelek wygląda i gdzie prowadzi", tabela `applications` na „czy wolno"**. Powłoka (`GET /api/me/access`) czyta WYŁĄCZNIE bazę; `tiles.ts` nie ma już żadnego wpływu na uprawnienia (allowlista `AUTHORIZED_APP_CODES` zniknęła razem z `app/idp/app/api/_lib/access.ts`).

Praktyczne skutki:

- Kod nieobecny w `applications` **nigdy** nie trafi do `apps` — SQL go nie zwróci. Nowy kafelek wymaga wiersza w rejestrze (seed `packages/@cortex/db/scripts/seed-system-config.mjs`), nie tylko wpisu w `TILES`.
- Kafelek obecny w `TILES`, ale bez wiersza w `applications`, jest nieosiągalny dla wszystkich — i to jest zachowanie zamierzone (fail-closed), nie usterka.
- Kod obecny w `applications`, ale bez wpisu w `TILES`, jest **uprawnieniem, nie kafelkiem**: nie wyrenderuje się w hubie, ale otwiera funkcje w środku innego kafelka. Dziś trzy takie: `ai-tools` (grant zbiorczy na wszystkie narzędzia AI) oraz `intrastat-cn-editor` / `intrastat-config-editor` (przyciski edycji w Intrastacie; realną egzekucją zajmuje się zewnętrzny backend FastAPI).
- `route`/`url` w rejestrze są celowo identyczne z `href` odpowiadającego wpisu w `TILES` — rejestr i kod mają wskazywać to samo miejsce.

> [!warning] Do rozstrzygnięcia przed „hubem z bazy"
> Schemat NIE odróżnia dziś „kafelka" od „samego uprawnienia" — jedno i drugie to wiersz w `applications`. Dopóki hub renderuje z `TILES`, jest to nieszkodliwe (te trzy kody po prostu nie mają odpowiednika w kodzie). W momencie, w którym hub zacznie renderować z rejestru, trzeba je rozróżnić — dedykowaną `category`, flagą w schemacie albo osobną tabelą. Decyzja nie została podjęta; patrz otwarte pytanie 2 w `PROJECT/cortex-frontend-unifikacja-bramek-projekt.md`.

## Docelowo — rejestr edytowalny z UI (wymóg Cezarego, 28.07.2026)

"Ustawianie kafelków w instancji ma być z UI, nie edycją plików." Realizacja: tabela `applications` (rozszerzona o `route`/`kind`/`url`) w schemacie `system_config` (`@cortex/db`) + ekran CRUD w module Konfiguracja Systemu. Zastępuje hardcoded `tiles.ts` — nie plik `services-config.json` (to wzorzec starego `cortex-box-prototype`, świadomie porzucony).

## Ścieżka pod przyszłą samodzielność klientów (nie teraz, ale projektować z myślą o tym)

Zbadane wzorce branżowe (Shopify/Salesforce/Retool/Notion): bezpieczna droga to zewnętrzny serwis klienta + cienki kontrakt (`external-link`/`iframe`), nigdy wykonywanie cudzego kodu w naszym procesie. Rejestr kafelków projektowany TERAZ z polem `kind` już to wspiera — klient dopisujący własny kafelek to w praktyce nowy wiersz `external-link` wskazujący na jego własny, osobno hostowany serwis. Nic więcej nie trzeba budować, żeby to było możliwe w przyszłości.
