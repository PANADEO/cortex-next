# Uruchomienie lokalne

Cel: jedna komenda, zero ręcznej konfiguracji Postgresa, przeglądarka na
`http://localhost:3000` pokazuje działający, zalogowany hub z dostępem
administratora. Nie architektura — po decyzje/uzasadnienia patrz
`docs/infrastructure.md`.

## Wymagania

Tylko Docker (z Docker Compose v2 — `docker compose`, nie `docker-compose`).
Żadnego lokalnego node/pnpm, żadnej ręcznie stawianej bazy.

## Start

```bash
docker compose up
```

To wszystko. `docker-compose.yml` w korzeniu repo buduje obraz lokalnie i
stawia: `postgres`, krok `migrate` (migracje + wszystkie seedy, kończy się i
gasi), `cortex-frontend`, oraz mikroserwisy Pythona, których kafelki
faktycznie potrzebują (`geo-score-calculator`, `document-parser-backend` +
`document-parser-unoserver`). `cortex-frontend` startuje dopiero po
powodzeniu `migrate` (`service_completed_successfully`) — świeża, pusta baza
nigdy nie zostaje zaserwowana.

Pierwsze uruchomienie buduje obraz od zera (kilka minut). Kolejne `docker
compose up` używają cache'a warstw i startują w kilkanaście sekund.

## Dostęp

Otwórz `http://localhost:3000`.

Bez żadnej zmiennej env jesteś zalogowany jako **`dev@cortex.local`** —
pełny administrator (rola `admin`, grant do wszystkich zarejestrowanych
aplikacji). Mechanizm: `docker-compose.yml` domyślnie ustawia zarówno
`ADMIN_EMAIL`, jak i `DEV_USER_EMAIL` na `dev@cortex.local` — pierwsza
zmienna każe krokowi `migrate` założyć to konto z rolą admin, druga każe
appce traktować Cię jako to konto, gdy nie ma nagłówka `x-auth-request-email`
(realne, produkcyjne uwierzytelnienie przez oauth2-proxy — poza zakresem tego
compose, patrz nagłówek pliku `docker-compose.yml`). Jeśli chcesz się widzieć
pod własnym adresem, ustaw `ADMIN_EMAIL=ty@twojadomena.pl` w `.env` obok
`docker-compose.yml` — `DEV_USER_EMAIL` podąży za nią automatycznie, o ile
sam jej nie nadpiszesz.

### Cztery kafelki z tej sesji

**Kreator treści (Content Guru)** jest aktywny od razu.

**Kalkulator GEO Score**, **Parser Dokumentów** i **Visual Guru** rejestrują
się w bazie jako kandydaci, ale ZOSTAJĄ nieaktywne do jednorazowej ręcznej
aktywacji — to świadomy mechanizm rejestru kafelków (`docs/tile-registry.md`),
nie luka tego compose. Jako zalogowany administrator:

1. Wejdź w **Konfiguracja Systemu → Aplikacje**.
2. Przy każdym z trzech kafelków kliknij **„Dodaj aplikację"**.

Po aktywacji kafelek od razu pojawia się na hubie — bez restartu kontenera.

## Generowanie AI (opcjonalnie)

Ekrany wszystkich czterech kafelków ładują się i przechodzą RBAC bez
dodatkowej konfiguracji. Żeby przyciski „Generuj" faktycznie zwracały wynik
modelu, `cortex-frontend` musi dogadać się z **cortex-proxy** — osobnym
serwisem, celowo POZA tym compose (`docs/database.md`). Domyślnie
`CORTEX_PROXY_URL=http://host.docker.internal:8240`:

```bash
cd ~/REPO/cortex-proxy && docker compose up -d
```

Bez tego wywołania modeli kończą się czytelnym błędem (503/502), reszta
appki (nawigacja, RBAC, listy, konfiguracja) działa normalnie.

## Zatrzymanie / reset

```bash
docker compose down          # zatrzymuje, dane w Postgresie zostają
docker compose down -v       # + kasuje wolumen Postgresa — następny `up` startuje od zera
```

## Rozwiązywanie problemów

**Port 3000 (albo 5432) zajęty** — nadpisz w `.env` obok `docker-compose.yml`:
`FRONTEND_PORT=3001` i/lub `POSTGRES_PORT=5433`.

**Zalogowany jako `dev@cortex.local`, ale kafelek pokazuje brak dostępu** —
sprawdź, czy to jeden z trzech kafelków wymagających ręcznej aktywacji (patrz
wyżej). Dla pozostałych: `docker compose down -v && docker compose up` daje
czysty start z pełnym grantem.

**`docker compose up` wisi na `migrate`** — `docker compose logs migrate`;
najczęstsza przyczyna to Postgres, który jeszcze nie zdążył przejść
healthchecka (`depends_on: condition: service_healthy` powinno to obsłużyć
samo, ale przy bardzo wolnym dysku daj mu chwilę więcej).

**Generowanie AI zwraca błąd** — sprawdź, czy `cortex-proxy` faktycznie
działa i czy `CORTEX_PROXY_URL` w Twoim `.env` (jeśli nadpisany) na niego
wskazuje — patrz sekcja wyżej.
