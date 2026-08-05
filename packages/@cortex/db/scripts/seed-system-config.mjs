// Seed modułu Konfiguracja Systemu.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... ADMIN_EMAIL=ktos@firma.pl pnpm --filter @cortex/db db:seed
//
// Model: DEKLARACJA STANU DOCELOWEGO, nie jednorazowy bootstrap.
//
//   REJESTR APLIKACJI — seed zakłada brakujące wiersze w `applications`.
//   Dla name/description/icon/kind/route/url/target/sort_order
//   działa `on conflict do nothing`, więc zmiany zrobione w UI PRZEŻYWAJĄ
//   deploy. To jest jedyne źródło prawdy o tym, jakie kody uprawnień w ogóle
//   istnieją w tej instancji: powłoka (`/api/me/access`) czyta wyłącznie tę
//   tabelę, nie żadną allowlistę w kodzie.
//
//   PIĘĆ KOLUMN HUB-RENDERU (show_on_hub/color/category_functional/
//   category_department/activated_at, Krok 1 —
//   PROJECT/cortex-frontend-hub-db-driven-projekt.md) mają WŁASNY, częściowy
//   upsert: `on conflict do update` ograniczony wyłącznie do tych pięciu
//   kolumn (activated_at przez coalesce — nigdy nie cofa raz ustawionej
//   daty). Reszta kolumn wiersza zostaje nietknięta. Zero konsumenta czyta te
//   pola jeszcze (hub nadal renderuje z tiles.ts) — dopóki UI do ich edycji
//   nie istnieje (Krok 3), to rozróżnienie jest teoretyczne; kiedy powstanie,
//   ten upsert trzeba będzie zrewidować pod tym samym kątem co resztę pól.
//
//   WYJĄTEK — WIERSZ BEZ HISTORII AKTYWACJI (`activated_at is null`):
//   częściowy upsert wyżej zakłada, że konflikt oznacza wiersz z prawdziwymi
//   danymi. Odkąd seed-tile-manifests.mjs wyprzedza ten skrypt w łańcuchu
//   migrate (docker-compose*.yml) i pre-tworzy wiersz dla KAŻDEGO kodu z
//   manifestem — czyli dziś także dla większości kodów z APPLICATIONS niżej,
//   nie tylko ilustromat/token-usage — pierwsze uruchomienie TEGO skryptu na
//   świeżej bazie trafia w konflikt na niemal każdym kodzie, zanim
//   kiedykolwiek zdążył wstawić własny wiersz. Bez wyjątku taki wiersz
//   zostawałby TRWALE z placeholderem z seed-tile-manifests.mjs
//   (is_active=false, name=label manifestu, icon=null) — częściowy
//   upsert nigdy więcej by go nie dotknął. Dlatego: gdy istniejący wiersz ma
//   `activated_at is null`, upsert DODATKOWO backfilluje
//   name/description/icon/kind/route/url/target/sort_order/
//   is_active do wartości z APPLICATIONS, tak jak przy świeżym INSERCIE — ten
//   sam guard (`activated_at is null`) co w seed-ilustromat.mjs/
//   seed-token-usage.mjs, tu wyrażony przez CASE WHEN w SET zamiast osobnego
//   UPDATE (patrz komentarz przy zapytaniu niżej po co). Wiersz z
//   jakąkolwiek historią aktywacji — zmigrowany w Kroku 1 z activated_at
//   ustawionym, albo już zbackfillowany tą gałęzią w poprzednim uruchomieniu
//   — zostaje odtąd całkowicie poza zasięgiem tego wyjątku: admin-edits na
//   tych polach przez UI nadal przeżywają deploy.
//
//   ADMIN_EMAIL USTAWIONE — przy KAŻDYM uruchomieniu seed zapewnia, że ten
//   DOKŁADNIE jeden adres ma: aktywne konto w `users` (zakłada je, jeśli nie
//   istnieje; REAKTYWUJE, jeśli było wyłączone), rolę `admin` i grant tej roli
//   do WSZYSTKICH aplikacji z rejestru. Bezwarunkowo. Seed NIE pyta, czy jest
//   już jakiś administrator, i nie zgaduje po kodzie roli — sprawdza tylko ten
//   adres.
//
//   ADMIN_EMAIL NIEUSTAWIONE — seed nie wykonuje tego bloku w ogóle. Nie
//   zakłada konta, nie nadaje roli, niczego nie sprawdza. Rejestr aplikacji
//   powstaje mimo to (jest potrzebny niezależnie od tego, kto jest adminem).
//
// Reaktywacja jest ZAMIERZONA, nie backdoorem: nie ma tu ukrytej heurystyki,
// jest jawna deklaracja "ten adres ma zawsze być administratorem", widoczna
// w konfiguracji deployu i pod kontrolą tych samych ludzi, którzy tę
// konfigurację i tak trzymają. To reconciliation loop, nie luka.
//
// KONSEKWENCJA DO ŚWIADOMEGO PRZYJĘCIA: odebranie administratorowi dostępu do
// KTÓREGOKOLWIEK modułu przez UI cofnie się przy najbliższym deployu. Wcześniej
// ta reguła obowiązywała dla `system-config` (i `ilustromat` w jego własnym
// seedzie) — tutaj rozszerzamy jej ZASIĘG na cały rejestr, nie zmieniamy jej
// natury.
//
// ŻEBY TRWALE ODEBRAĆ TEMU KONTU AUTOMATYCZNE PRZYWRACANIE DOSTĘPU, USUŃ
// `ADMIN_EMAIL` Z KONFIGURACJI DEPLOYU (compose/Ansible/.env na serwerze) —
// dezaktywacja albo odebranie roli przez UI zostanie cofnięte przy najbliższym
// uruchomieniu seeda, dopóki ta zmienna tam jest.
//
// Odzyskiwanie ręczne (bez ADMIN_EMAIL): nadanie roli SQL-em działa, ale
// UWAGA — uprawnienia są cache'owane per proces aplikacji na 30 s i SQL tego
// cache'u nie czyści. Po ręcznym nadaniu roli dostęp wraca dopiero po tych do
// 30 s (albo od razu po restarcie procesu); pierwsze żądanie po zmianie nadal
// dostanie 403 i NIE znaczy to, że naprawa nie zadziałała.
//
// Czysty .mjs (bez kompilacji TS) — ma działać jako krok deployu jednym
// `node`, bez toolchainu build.

import postgres from "postgres"

const ADMIN_ROLE_CODE = "admin"

// Rejestr aplikacji instancji. `route`/`url` są CELOWO identyczne z `href`
// odpowiadającego wpisu w app/idp/lib/tiles.ts — rejestr i kod mają wskazywać
// dokładnie to samo miejsce (ten sam zabieg co przy `system-config`).
//
// Cztery wiersze NIE są kafelkami, tylko uprawnieniami (stąd showOnHub: false
// niżej): `ai-tools` i `cortex-cowork` (granty zbiorcze — kod sam nigdy nie
// renderuje własnej karty, tylko bramkuje rodzinę kafelków renderowaną gdzie
// indziej) oraz `intrastat-cn-editor` / `intrastat-config-editor`
// (odblokowują przyciski edycji WEWNĄTRZ kafelka Intrastat; realną
// egzekucją zajmuje się zewnętrzny backend FastAPI). Mają `route`, bo schemat
// wymaga go dla kind='native' — wskazuje ekran, którego dotyczą.
//
// `color`/`categoryFunctional`/`categoryDepartment` są 1:1 z
// app/idp/lib/tiles.ts (`iconBg` -> nazwa rodziny koloru Tailwind) i
// AI_TOOL_TILE_STYLE dla narzędzi AI. Dla czterech wierszy-uprawnień wyżej
// nie ma odpowiednika w tiles.ts (nic tam nie renderują) — zostają `null`,
// zgodnie ze schematem (D2/D3, PROJECT/cortex-frontend-hub-db-driven-projekt.md).
//
// `ilustromat`/`token-usage` NIE są tutaj świadomie: mają własne manifesty
// (@cortex/tile-sdk defineTile()) i ich wiersz applications powstaje przez
// seed-tile-manifests.mjs (wcześniej w łańcuchu migrate) — ich własne seedy
// (scripts/seed-ilustromat.mjs, scripts/seed-token-usage.mjs) już tylko go
// odczytują i grantują, nie insertują (PROJECT/cortex-frontend-hub-db-driven-projekt.md
// D10-rewizja c, otwarte pytanie f).
const APPLICATIONS = [
  {
    code: "idp",
    name: "IDP",
    description: "Procesowanie i ekstrakcja danych z dokumentów handlowych",
    icon: "ScanText",
    kind: "native",
    route: "/idp/dashboard",
    color: "rose",
    categoryFunctional: "misc",
    categoryDepartment: ["operations"],
  },
  {
    code: "idp-basic",
    name: "IDP Basic",
    description: "Uproszczone procesowanie dokumentów w osobnym pipeline",
    icon: "FileText",
    kind: "native",
    route: "/idp-basic/dashboard",
    color: "sky",
    categoryFunctional: "misc",
    categoryDepartment: ["operations"],
  },
  {
    code: "sp-console",
    name: "Store-Pit Re-Rating",
    description: "Przeliczanie faktur przewoźnika na rozliczenia per klient",
    icon: "Workflow",
    kind: "native",
    route: "/store-pit/dashboard",
    color: "cyan",
    categoryFunctional: "agents",
    categoryDepartment: ["finance", "operations"],
  },
  {
    code: "sp-client",
    name: "Store-Pit Client Zone",
    description: "Widok klienta — jego przesyłki i kwota do rozliczenia",
    icon: "Users",
    kind: "native",
    route: "/store-pit/clients",
    color: "indigo",
    categoryFunctional: "misc",
    categoryDepartment: ["finance"],
  },
  {
    code: "okna-czasowe",
    name: "Okna czasowe",
    description: "Śledzenie dostępności filmów na Rakuten TV PL",
    icon: "CalendarClock",
    kind: "native",
    route: "/okna-czasowe/dashboard",
    color: "amber",
    categoryFunctional: "research",
    categoryDepartment: ["marketing"],
  },
  {
    code: "cortex-config",
    name: "Cortex Config",
    description: "Governance platformy — projekty agentowe, role i grupy skilli",
    icon: "ShieldCheck",
    kind: "native",
    route: "/cortex-config/projects",
    color: "emerald",
    categoryFunctional: "admin-system",
    categoryDepartment: ["it"],
  },
  {
    code: "cortex-cowork",
    name: "Cortex Cowork",
    description: "Przestrzeń pracy z agentami — sesje, artefakty i skille",
    icon: "Bot",
    kind: "native",
    route: "/cortex-cowork",
    showOnHub: false,
  },
  {
    code: "intrastat",
    name: "Intrastat",
    description: "Przygotowanie importowych Exceli WNT/WDT z faktur",
    icon: "FileSpreadsheet",
    kind: "native",
    route: "/intrastat/dashboard",
    color: "emerald",
    categoryFunctional: "misc",
    categoryDepartment: ["operations", "finance"],
  },
  {
    code: "invoice-supervisor",
    name: "Nadzorca Faktur",
    description: "Nadzoruje terminy faktur i generuje AI przypomnienia płatnicze",
    icon: "Receipt",
    kind: "native",
    route: "/invoice-supervisor/inbox",
    color: "orange",
    categoryFunctional: "misc",
    categoryDepartment: ["finance", "operations"],
  },
  {
    code: "meeting-guru",
    name: "Nagrywanie Spotkań",
    description: "Asystent spotkań — nagrywanie, transkrypcja i wskazówki AI na żywo",
    icon: "Video",
    kind: "external-link",
    url: "https://chat.megu.me",
    target: "_blank",
    color: "teal",
    categoryFunctional: "agents",
    categoryDepartment: ["operations"],
  },
  {
    code: "system-config",
    name: "Konfiguracja Systemu",
    description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
    icon: "Settings",
    kind: "native",
    route: "/system-config",
    color: "slate",
    categoryFunctional: "admin-system",
    categoryDepartment: ["it"],
  },
  {
    code: "ai-tools",
    name: "AI Tools",
    description: "Grant zbiorczy — dostęp do wszystkich narzędzi AI naraz",
    icon: "Sparkles",
    kind: "native",
    route: "/ai-tools",
    showOnHub: false,
  },
  {
    code: "text-highlighter",
    name: "Podświetlacz tekstu",
    description: "Zaznacza kluczowe fragmenty w tekście",
    icon: "Highlighter",
    kind: "native",
    route: "/ai-tools/text-highlighter",
    color: "blue",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "operations", "it"],
  },
  {
    code: "text-transformer",
    name: "Transformator tekstu",
    description: "Przekształca tekst według wybranego stylu",
    icon: "Wand2",
    kind: "native",
    route: "/ai-tools/text-transformer",
    color: "blue",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "operations", "it"],
  },
  {
    code: "text-analyzer",
    name: "Analizator tekstu",
    description: "Analiza treści, tonu i struktury tekstu",
    icon: "TextCursorInput",
    kind: "native",
    route: "/ai-tools/text-analyzer",
    color: "blue",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "operations", "it"],
  },
  {
    code: "ai-summarizer",
    name: "Sumaryzator",
    description: "Skraca długie teksty do streszczenia",
    icon: "FileText",
    kind: "native",
    route: "/ai-tools/ai-summarizer",
    color: "blue",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "operations", "it"],
  },
  {
    code: "content-guru",
    name: "Kreator treści",
    description: "Generuje treści marketingowe i redakcyjne",
    icon: "Sparkles",
    kind: "native",
    // Faza 0 (PROJECT/cortex-frontend-content-guru-full-port-projekt.md D1):
    // route zmieniony z "/ai-tools/content-guru" na docelowy "/content-guru",
    // spójnie z content-guru.manifest.ts. Na już aktywowanym wierszu (jak na
    // każdej realnej instancji) TA linia i tak nie decyduje o finalnej
    // wartości — `route` tego kodu jest strukturalnym polem manifestu i
    // seed-tile-manifests.mjs (uruchamiany PRZED tym skryptem w łańcuchu
    // migrate) nadpisuje je bezwarunkowo, na każdym deployu, patrz komentarz
    // przy `on conflict` tamtego skryptu — to WYSTARCZYŁO, żeby zaktualizować
    // już aktywowany wiersz (zweryfikowane empirycznie 03.08.2026, żaden
    // ręczny UPDATE nie był potrzebny, w przeciwieństwie do rename
    // presentation-generator, gdzie zmieniał się `code`, nie tylko `route`).
    // Ta wartość tutaj ma znaczenie wyłącznie na ŚWIEŻEJ bazie
    // (activated_at IS NULL) — tam wygrywa, bo częściowy upsert niżej
    // backfilluje route razem z resztą kolumn. Aktualizowana dla spójności
    // obu źródeł.
    route: "/content-guru",
    color: "violet",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "hr", "operations"],
  },
  {
    code: "linkedin-generator",
    name: "Generator LinkedIn",
    description: "Tworzy posty na LinkedIn",
    icon: "MessageSquareText",
    kind: "native",
    route: "/ai-tools/linkedin-generator",
    color: "violet",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "hr", "operations"],
  },
  {
    code: "presentation-generator",
    name: "Generator prezentacji",
    description: "Buduje szkielet prezentacji z opisu",
    icon: "Presentation",
    kind: "native",
    route: "/ai-tools/presentation-generator",
    color: "violet",
    categoryFunctional: "content-generation",
    categoryDepartment: ["marketing", "hr", "operations"],
  },
  {
    code: "fakturomat",
    name: "Analizator faktur",
    description: "Wyciąga dane z faktur i je podsumowuje",
    icon: "ReceiptText",
    kind: "native",
    route: "/ai-tools/fakturomat",
    color: "amber",
    categoryFunctional: "misc",
    categoryDepartment: ["finance", "operations"],
  },
  {
    code: "ai-daily-assistant",
    name: "Chatbot AI",
    description: "Asystent ogólnego przeznaczenia",
    icon: "Bot",
    kind: "native",
    route: "/ai-tools/ai-daily-assistant",
    color: "indigo",
    categoryFunctional: "agents",
    categoryDepartment: ["operations", "it"],
  },
  {
    code: "intrastat-cn-editor",
    name: "Intrastat — edycja kodów CN",
    description: "Uprawnienie: edycja słownika kodów CN wewnątrz kafelka Intrastat",
    icon: "FileSpreadsheet",
    kind: "native",
    route: "/intrastat/resources",
    showOnHub: false,
  },
  {
    code: "intrastat-config-editor",
    name: "Intrastat — edycja konfiguracji",
    description: "Uprawnienie: edycja ustawień wewnątrz kafelka Intrastat",
    icon: "FileSpreadsheet",
    kind: "native",
    route: "/intrastat/settings",
    showOnHub: false,
  },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    const [role] = await tx`
      insert into system_config.roles (code, name, description, is_system)
      values (${ADMIN_ROLE_CODE}, 'Administrator', 'Pełny dostęp do konfiguracji systemu', true)
      on conflict (code) do update set is_system = true
      returning id
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE}: ok`)

    let inserted = 0
    for (const [index, application] of APPLICATIONS.entries()) {
      const [row] = await tx`
        -- Kolumna "category" (wolny tekst) NIE JEST tu wymieniana świadomie —
        -- wycofana 05.08.2026, patrz komentarz przy schemacie w
        -- src/schema/system-config.ts. Zostaje w bazie z legacy wartościami,
        -- ale żadna ścieżka zapisu (seed ani UI) jej już nie dotyka.
        insert into system_config.applications
          (code, name, description, icon, kind, route, url, target, sort_order,
           show_on_hub, color, category_functional, category_department, activated_at)
        values (
          ${application.code}, ${application.name}, ${application.description},
          ${application.icon}, ${application.kind},
          ${application.route ?? null}, ${application.url ?? null},
          ${application.target ?? null}, ${index * 10},
          ${application.showOnHub ?? true}, ${application.color ?? null},
          ${application.categoryFunctional ?? null}, ${application.categoryDepartment ?? null},
          now()
        )
        -- Częściowy upsert: name/description/icon/kind/route/url/target/
        -- sort_order/is_active NIE są bezwarunkowo nadpisywane (zostają "on
        -- conflict do nothing" w duchu), więc zmiany zrobione w UI na tych
        -- polach przeżywają deploy jak dotychczas — Z WYJĄTKIEM niżej.
        -- Backfillujemy bezwarunkowo WYŁĄCZNIE pięć kolumn hub-renderu (Krok 1,
        -- PROJECT/cortex-frontend-hub-db-driven-projekt.md) — activated_at przez
        -- coalesce, żeby drugi i kolejne uruchomienia NIE nadpisywały już
        -- ustawionej daty pierwszej aktywacji świeżym now().
        --
        -- WYJĄTEK (patrz komentarz na górze pliku): gdy istniejący wiersz ma
        -- activated_at is null — nigdy nie miał prawdziwych danych, np.
        -- pre-utworzony przez seed-tile-manifests.mjs jako nieaktywny kandydat
        -- — CASE WHEN niżej backfillują TEŻ name/description/icon/
        -- kind/route/url/target/sort_order/is_active z APPLICATIONS, jak przy
        -- świeżym INSERCIE. Bezpieczne mimo że activated_at jest ustawiane w
        -- TYM SAMYM SET: Postgres liczy wszystkie wyrażenia jednego
        -- UPDATE/ON CONFLICT DO UPDATE SET względem wiersza SPRZED tej
        -- operacji (jak OLD w triggerze), nie sekwencyjnie — odwołanie do
        -- system_config.applications.activated_at w każdym CASE WHEN niżej
        -- zawsze widzi wartość PRZED tym zapytaniem, więc dotyczy wyłącznie
        -- wierszy bez żadnej historii aktywacji.
        on conflict (code) do update set
          name = case when system_config.applications.activated_at is null
            then excluded.name else system_config.applications.name end,
          description = case when system_config.applications.activated_at is null
            then excluded.description else system_config.applications.description end,
          icon = case when system_config.applications.activated_at is null
            then excluded.icon else system_config.applications.icon end,
          kind = case when system_config.applications.activated_at is null
            then excluded.kind else system_config.applications.kind end,
          route = case when system_config.applications.activated_at is null
            then excluded.route else system_config.applications.route end,
          url = case when system_config.applications.activated_at is null
            then excluded.url else system_config.applications.url end,
          target = case when system_config.applications.activated_at is null
            then excluded.target else system_config.applications.target end,
          sort_order = case when system_config.applications.activated_at is null
            then excluded.sort_order else system_config.applications.sort_order end,
          is_active = case when system_config.applications.activated_at is null
            then true else system_config.applications.is_active end,
          show_on_hub = excluded.show_on_hub,
          color = excluded.color,
          category_functional = excluded.category_functional,
          category_department = excluded.category_department,
          activated_at = coalesce(system_config.applications.activated_at, excluded.activated_at)
        returning id, (xmax = 0) as inserted
      `
      if (row?.inserted) inserted += 1
    }
    console.log(
      `[seed] rejestr aplikacji: ${APPLICATIONS.length} kodów, dopisano ${inserted} nowych ` +
        `(pozostałe: backfill show_on_hub/color/category_functional/category_department/activated_at)`,
    )

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL nieustawione — pomijam deklarację administratora.")
      return
    }

    const [user] = await tx`
      insert into system_config.users (email, full_name, is_active)
      values (${adminEmail}, 'Administrator', true)
      on conflict (email) do update set is_active = true, updated_at = now()
      returning id
    `
    console.log(`[seed] konto ${adminEmail}: aktywne`)

    await tx`
      insert into system_config.user_roles (user_id, role_id)
      values (${user.id}, ${role.id})
      on conflict do nothing
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE} -> ${adminEmail}: ok`)

    // Celowo "wszystkie wiersze w applications", nie "wszystkie wiersze z tego
    // pliku": administrator instancji ma widzieć również aplikacje dodane
    // ręcznie przez UI i te zarejestrowane przez seedy innych modułów
    // (np. ilustromat), niezależnie od kolejności uruchamiania seedów.
    const granted = await tx`
      insert into system_config.permissions_matrix (role_id, application_id)
      select ${role.id}, id from system_config.applications
      on conflict do nothing
      returning application_id
    `
    console.log(
      `[seed] granty ${ADMIN_ROLE_CODE} -> wszystkie aplikacje: ok (dopisano ${granted.length})`,
    )
  })
}

try {
  await main()
  console.log("[seed] zakończono.")
} catch (error) {
  console.error("[seed] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
