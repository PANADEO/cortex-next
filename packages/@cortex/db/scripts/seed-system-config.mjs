// Seed modułu Konfiguracja Systemu.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... ADMIN_EMAIL=ktos@firma.pl pnpm --filter @cortex/db db:seed
//
// Model: DEKLARACJA STANU DOCELOWEGO, nie jednorazowy bootstrap.
//
//   REJESTR APLIKACJI — seed zakłada brakujące wiersze w `applications`
//   (`on conflict do nothing`, więc zmiany nazwy/ikony/kategorii zrobione
//   w UI PRZEŻYWAJĄ deploy). To jest jedyne źródło prawdy o tym, jakie kody
//   uprawnień w ogóle istnieją w tej instancji: powłoka (`/api/me/access`)
//   czyta wyłącznie tę tabelę, nie żadną allowlistę w kodzie.
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
// Trzy wiersze NIE są kafelkami, tylko uprawnieniami: `ai-tools` (grant
// zbiorczy na wszystkie narzędzia AI, obok grantów per narzędzie) oraz
// `intrastat-cn-editor` / `intrastat-config-editor` (odblokowują przyciski
// edycji WEWNĄTRZ kafelka Intrastat; realną egzekucją zajmuje się zewnętrzny
// backend FastAPI). Mają `route`, bo schemat wymaga go dla kind='native' —
// wskazuje ekran, którego dotyczą. Rozróżnienie "kafelek vs samo uprawnienie"
// nie jest jeszcze w schemacie; stanie się potrzebne dopiero, gdy hub zacznie
// renderować z rejestru zamiast z tiles.ts.
//
// `ilustromat` NIE jest tutaj świadomie: moduł z własnym schematem rejestruje
// się we własnym seedzie (scripts/seed-ilustromat.mjs) — precedens zostaje.
const APPLICATIONS = [
  {
    code: "idp",
    name: "IDP",
    description: "Procesowanie i ekstrakcja danych z dokumentów handlowych",
    icon: "ScanText",
    category: "Dokumenty",
    kind: "native",
    route: "/idp/dashboard",
  },
  {
    code: "idp-basic",
    name: "IDP Basic",
    description: "Uproszczone procesowanie dokumentów w osobnym pipeline",
    icon: "FileText",
    category: "Dokumenty",
    kind: "native",
    route: "/idp-basic/dashboard",
  },
  {
    code: "sp-console",
    name: "Store-Pit Re-Rating",
    description: "Przeliczanie faktur przewoźnika na rozliczenia per klient",
    icon: "Workflow",
    category: "Finanse",
    kind: "native",
    route: "/store-pit/dashboard",
  },
  {
    code: "sp-client",
    name: "Store-Pit Client Zone",
    description: "Widok klienta — jego przesyłki i kwota do rozliczenia",
    icon: "Users",
    category: "Finanse",
    kind: "native",
    route: "/store-pit/clients",
  },
  {
    code: "okna-czasowe",
    name: "Okna czasowe",
    description: "Śledzenie dostępności filmów na Rakuten TV PL",
    icon: "CalendarClock",
    category: "Badania",
    kind: "native",
    route: "/okna-czasowe/dashboard",
  },
  {
    code: "cortex-config",
    name: "Cortex Config",
    description: "Governance platformy — projekty agentowe, role i grupy skilli",
    icon: "ShieldCheck",
    category: "Administracja",
    kind: "native",
    route: "/cortex-config/projects",
  },
  {
    code: "cortex-cowork",
    name: "Cortex Cowork",
    description: "Przestrzeń pracy z agentami — sesje, artefakty i skille",
    icon: "Bot",
    category: "Agenci",
    kind: "native",
    route: "/cortex-cowork",
  },
  {
    code: "intrastat",
    name: "Intrastat",
    description: "Przygotowanie importowych Exceli WNT/WDT z faktur",
    icon: "FileSpreadsheet",
    category: "Dokumenty",
    kind: "native",
    route: "/intrastat/dashboard",
  },
  {
    code: "invoice-supervisor",
    name: "Nadzorca Faktur",
    description: "Nadzoruje terminy faktur i generuje AI przypomnienia płatnicze",
    icon: "Receipt",
    category: "Finanse",
    kind: "native",
    route: "/invoice-supervisor/inbox",
  },
  {
    code: "meeting-guru",
    name: "Nagrywanie Spotkań",
    description: "Asystent spotkań — nagrywanie, transkrypcja i wskazówki AI na żywo",
    icon: "Video",
    category: "Agenci",
    kind: "external-link",
    url: "https://chat.megu.me",
    target: "_blank",
  },
  {
    code: "system-config",
    name: "Konfiguracja Systemu",
    description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
    icon: "Settings",
    category: "Administracja",
    kind: "native",
    route: "/system-config",
  },
  {
    code: "ai-tools",
    name: "AI Tools",
    description: "Grant zbiorczy — dostęp do wszystkich narzędzi AI naraz",
    icon: "Sparkles",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools",
  },
  {
    code: "text-highlighter",
    name: "Podświetlacz tekstu",
    description: "Zaznacza kluczowe fragmenty w tekście",
    icon: "Highlighter",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/text-highlighter",
  },
  {
    code: "text-transformer",
    name: "Transformator tekstu",
    description: "Przekształca tekst według wybranego stylu",
    icon: "Wand2",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/text-transformer",
  },
  {
    code: "text-analyzer",
    name: "Analizator tekstu",
    description: "Analiza treści, tonu i struktury tekstu",
    icon: "TextCursorInput",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/text-analyzer",
  },
  {
    code: "ai-summarizer",
    name: "Sumaryzator",
    description: "Skraca długie teksty do streszczenia",
    icon: "FileText",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/ai-summarizer",
  },
  {
    code: "content-guru",
    name: "Kreator treści",
    description: "Generuje treści marketingowe i redakcyjne",
    icon: "Sparkles",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/content-guru",
  },
  {
    code: "linkedin-generator",
    name: "Generator LinkedIn",
    description: "Tworzy posty na LinkedIn",
    icon: "MessageSquareText",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/linkedin-generator",
  },
  {
    code: "visual-guru",
    name: "Generator prezentacji",
    description: "Buduje szkielet prezentacji z opisu",
    icon: "Presentation",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/visual-guru",
  },
  {
    code: "fakturomat",
    name: "Analizator faktur",
    description: "Wyciąga dane z faktur i je podsumowuje",
    icon: "ReceiptText",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/fakturomat",
  },
  {
    code: "ai-daily-assistant",
    name: "Chatbot AI",
    description: "Asystent ogólnego przeznaczenia",
    icon: "Bot",
    category: "AI Tools",
    kind: "native",
    route: "/ai-tools/ai-daily-assistant",
  },
  {
    code: "intrastat-cn-editor",
    name: "Intrastat — edycja kodów CN",
    description: "Uprawnienie: edycja słownika kodów CN wewnątrz kafelka Intrastat",
    icon: "FileSpreadsheet",
    category: "Uprawnienia",
    kind: "native",
    route: "/intrastat/resources",
  },
  {
    code: "intrastat-config-editor",
    name: "Intrastat — edycja konfiguracji",
    description: "Uprawnienie: edycja ustawień wewnątrz kafelka Intrastat",
    icon: "FileSpreadsheet",
    category: "Uprawnienia",
    kind: "native",
    route: "/intrastat/settings",
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
        insert into system_config.applications
          (code, name, description, icon, category, kind, route, url, target, sort_order)
        values (
          ${application.code}, ${application.name}, ${application.description},
          ${application.icon}, ${application.category}, ${application.kind},
          ${application.route ?? null}, ${application.url ?? null},
          ${application.target ?? null}, ${index * 10}
        )
        on conflict (code) do nothing
        returning id
      `
      if (row) inserted += 1
    }
    console.log(
      `[seed] rejestr aplikacji: ${APPLICATIONS.length} kodów, dopisano ${inserted} nowych`,
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
