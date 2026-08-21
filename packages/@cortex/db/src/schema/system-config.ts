// Schemat modułu Konfiguracja Systemu — port funkcji cortex-admin do środka
// monolitu. Jedna baza Postgres, schema-per-moduł (docs/database.md).
//
// Siedem tabel, OBIE warstwy uprawnień naraz (code-db/REFERENCE.md):
//   - gruboziarnista: permissions_matrix (rola ma dostęp do kafelka albo nie),
//   - granularna: application_scopes + role_application_scopes (akcje w kafelku).
// To nie duplikat — cortex-admin ma obie i obie są używane.
//
// `applications` jest jednocześnie katalogiem uprawnień i REJESTREM KAFELKÓW
// (rozszerzenie względem cortex-admin: kind/route/url/target/icon/category).
// Jedno źródło prawdy — dokładnie po to, żeby nie dało się rozjechać kodu
// z bazą, jak w starym cortex-box-prototype/services-config.json.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

export const systemConfig = pgSchema("system_config")

/** Dozwolone wartości `applications.kind`. Musi odpowiadać TileKind
 *  z @cortex/tile-sdk — pilnuje tego test system-config.test.ts. */
export const APPLICATION_KINDS = ["native", "external-link", "iframe"] as const
export type ApplicationKind = (typeof APPLICATION_KINDS)[number]

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
const grantedAt = timestamp("granted_at", { withTimezone: true }).notNull().defaultNow()

export const users = systemConfig.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Zawsze zapisywany lowercase — dopasowanie e-maili jest case-insensitive.
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
})

export const roles = systemConfig.table("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Rola systemowa (np. admin) — chroniona przed usunięciem, wzorem cortex-admin.
  isSystem: boolean("is_system").notNull().default(false),
  createdAt,
  updatedAt,
})

export const userRoles = systemConfig.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
    // Klucz złożony pokrywa odczyt po user_id; "kto ma tę rolę" (i kaskada przy
    // usuwaniu roli) idzie po drugiej kolumnie i potrzebuje własnego indeksu.
    byRole: index("user_roles_role_id_idx").on(table.roleId),
  }),
)

export const applications = systemConfig.table(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Entitlement code — to po nim pyta requireTileAccess().
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    // Nazwa ikony lucide-react, nie ścieżka do pliku.
    icon: text("icon"),
    // WYCOFANA (05.08.2026, decyzja Alexa). Wolny tekst, który istniał
    // wyłącznie jako etykieta na liście admina Aplikacje — hub nigdy jej nie
    // czytał (patrz hubApplicationToTile, typ Tile nie ma takiego pola).
    // Formularz, schemat Zod serwisu i seedy już jej NIE zapisują; kolumna
    // zostaje w bazie, bo jest wypełniona na ~24 wierszach legacy, a DROP
    // COLUMN jest nieodwracalny i niczego nie kupuje. Do sprzątnięcia osobną
    // migracją, gdy nikt już nie będzie potrzebował tych wartości.
    // Nie usuwać z tego schematu przed migracją — drizzle-kit wygenerowałby
    // wtedy DROP COLUMN przy najbliższym `generate`.
    category: text("category"),
    kind: text("kind").notNull().default("native"),
    // native -> route (ścieżka w tym appie); external-link/iframe -> url.
    route: text("route"),
    url: text("url"),
    target: text("target"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    // Odróżnia kafelek od samego uprawnienia (docs/tile-registry.md,
    // PROJECT/cortex-frontend-hub-db-driven-projekt.md D1). `false` dla
    // wierszy, które nigdy nie renderują własnej karty na hubie (np. grant
    // zbiorczy `ai-tools`, flagi funkcji Intrastatu).
    showOnHub: boolean("show_on_hub").notNull().default(true),
    // Nazwa tokenu koloru (np. "rose", "sky"), NIE surowe klasy Tailwind —
    // JIT skanuje wyłącznie literalne stringi w źródłach, więc klasa
    // złożona w runtime z wartości bazy nigdy by się nie wygenerowała (D2).
    // Mapowanie token -> klasy żyje w kodzie (resolveTileColor, poza
    // zakresem tej migracji).
    color: text("color"),
    // Oś "Funkcje" na hubie. W UI: "Kategoria funkcjonalna".
    categoryFunctional: text("category_functional"),
    // Oś "Działy" na hubie. UWAGA — w UI ta kolumna nazywa się po prostu
    // "Kategoria" (decyzja Alexa 05.08.2026: jedna kategoria produktowa,
    // zamknięta lista, wielowartościowa). Nazwa kolumny została jak była,
    // bo rename wypełnionej kolumny to migracja + seedy + testy za zero
    // korzyści widocznej dla użytkownika.
    categoryDepartment: text("category_department").array(),
    // NULL = wiersz zarejestrowany w kodzie, nigdy nie aktywowany w tej
    // instancji. Nie-NULL = był aktywowany co najmniej raz — automatyczny
    // fakt ustawiany wyłącznie przez operację aktywacji, nigdy edytowany
    // ręcznie przez admina (D6-rewizja 02.08.2026, zastępuje wycofane
    // `has_implementation`).
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => ({
    kindAllowed: check(
      "applications_kind_allowed",
      sql`${table.kind} in ('native', 'external-link', 'iframe')`,
    ),
    // Niezmiennik pilnowany w bazie, nie tylko w formularzu: kafelek natywny ma
    // route i nie ma url; zewnętrzny/iframe odwrotnie.
    kindShape: check(
      "applications_kind_shape",
      sql`(${table.kind} = 'native' and ${table.route} is not null and ${table.url} is null)
          or (${table.kind} <> 'native' and ${table.url} is not null and ${table.route} is null)`,
    ),
    // Tak samo jak `kind`: dozwolone wartości pilnuje baza, nie tylko Zod.
    targetAllowed: check(
      "applications_target_allowed",
      sql`${table.target} is null or ${table.target} in ('_self', '_blank')`,
    ),
  }),
)

/**
 * Tłumaczenia nazwy i opisu kafelka — PROJECT/cortex-frontend/ARTIFACTS/i18n/
 * cortex-frontend-tlumaczenia-nazw-kafelkow-projekt.md.
 *
 * Zamyka lukę: angielskiej nazwy kafelka nie dało się zmienić z panelu, bo
 * siedziała w pliku `app/idp/locales/en/tiles.json`. Kafelek założony przez
 * admina pokazywał w angielskim interfejsie swoją polską nazwę.
 *
 * KLUCZ ZŁOŻONY (application_id, locale), a nie własne `id` z UNIQUE obok:
 * "jedno tłumaczenie na język na aplikację" to tożsamość tego wiersza, nie
 * dodatkowe ograniczenie. Ten sam układ co user_roles/permissions_matrix
 * wyżej. Efekt uboczny, na którym stoi zapis: `on conflict (application_id,
 * locale)` działa bez dodatkowego indeksu.
 *
 * `name` i `description` są OSOBNO NULL-owalne — wolno przetłumaczyć samą
 * nazwę i zostawić opis na wartości bazowej (`applications.description`).
 * Pusty napis z formularza zapisujemy jako NULL, a wiersz bez ANI JEDNEJ
 * wartości KASUJEMY (setApplicationTranslations w @cortex/service) — inaczej
 * baza zbiera puste rekordy, które wyglądają jak tłumaczenie, a nim nie są.
 * Tego niezmiennika NIE da się wyrazić CHECK-iem tak, żeby był użyteczny:
 * ograniczenie `name is not null or description is not null` odbiłoby zapis
 * błędem Postgresa zamiast po prostu usunąć wiersz, a to jest normalna
 * ścieżka (admin czyści oba pola), nie pomyłka wołającego.
 *
 * BEZ CHECK-a NA `locale`, tą samą decyzją co `instance_settings.
 * appearance_preset` niżej: lista języków żyje w kodzie aplikacji
 * (`LOCALES` w app/idp/lib/i18n/config.ts), więc ograniczenie w bazie
 * oznaczałoby migrację przy każdym nowym języku. Zamkniętą listę egzekwuje
 * warstwa serwisowa (`SUPPORTED_LOCALES` + test parzystości
 * system-config.locales-parity.test.ts), a wiersz w nieznanym języku jest
 * dla klienta martwy, nie wywracający (reguła rozstrzygania czyta
 * `translations[locale]`, więc klucz spoza listy nikogo nie dotyczy).
 *
 * `ON DELETE CASCADE`, bo tłumaczenie bez aplikacji nie znaczy nic.
 */
export const applicationTranslations = systemConfig.table(
  "application_translations",
  {
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    // Kod języka interfejsu ("en"), nie BCP-47 z regionem — dokładnie te same
    // wartości, co klucze w `resources` po stronie aplikacji.
    locale: text("locale").notNull(),
    name: text("name"),
    description: text("description"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.applicationId, table.locale] }),
  }),
)

/** Gruboziarnisty grant: rola ma dostęp do aplikacji (kafelka) albo nie.
 *  Odpowiednik permissions_matrix z cortex-admin. */
export const permissionsMatrix = systemConfig.table(
  "permissions_matrix",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.applicationId] }),
    // "które role mają dostęp do tej aplikacji" — ekran szczegółów aplikacji
    // i kaskada przy usuwaniu aplikacji czytają po tej kolumnie.
    byApplication: index("permissions_matrix_application_id_idx").on(table.applicationId),
  }),
)

/** Akcje możliwe w ramach jednej aplikacji (np. view/edit/generate). */
export const applicationScopes = systemConfig.table(
  "application_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt,
  },
  (table) => ({
    uniqueScopePerApplication: unique("application_scopes_application_code_unique").on(
      table.applicationId,
      table.code,
    ),
  }),
)

/** Granularny grant: rola ma konkretną akcję w konkretnej aplikacji. */
export const roleApplicationScopes = systemConfig.table(
  "role_application_scopes",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    applicationScopeId: uuid("application_scope_id")
      .notNull()
      .references(() => applicationScopes.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.applicationScopeId] }),
  }),
)

/**
 * Mapowanie rola -> grupa OpenWebUI (PROJECT/cortex-frontend-sync-uprawnien-
 * openwebui-projekt.md, D1 Wariant A — decyzja Alexa 31.07.2026: grupy
 * OpenWebUI lustrzanie odwzorowują ROLE, nie aplikacje). Osobna tabela, nie
 * kolumna w `roles` — mapowanie jest opcjonalne i rzadkie (1-3 wiersze z
 * wielu ról), a doklejenie stanu integracji (`last_sync_error`) do katalogu
 * ról zmieszałoby RBAC z księgowością pushowania do cudzego serwisu (D1).
 *
 * `roleId` jest PK: jedna rola = jedna grupa (jedna instancja OpenWebUI —
 * multi-instancyjność świadomie POZA zakresem, D5/pytanie otwarte 4).
 * `groupId` to UUID nadany PRZEZ OpenWebUI — jedyny stabilny klucz
 * dopasowania (D1: NIE nazwa, żeby nie powtórzyć błędu cortex-admina, gdzie
 * zmiana nazwy roli osierocała grupę razem z jej `access_control`).
 * `groupId` jest UNIQUE, czyli relacja jest dwustronnie 1:1 — Wariant A mówi
 * "jedna rola = jedna grupa", ale sam PK na `roleId` pilnował tylko jednej
 * strony. Dwie role wskazujące TĘ SAMĄ grupę wyliczają dwa różne zbiory
 * docelowe z tej samej żywej grupy, więc każde uzgodnienie wyrzuca członków
 * drugiej roli: dostęp znika i wraca zależnie od KOLEJNOŚCI synchronizacji,
 * a `last_sync_error` zostaje NULL. Ograniczenie w BAZIE, nie tylko sprawdzenie
 * w kodzie: sprawdź-potem-wstaw to TOCTOU — dwa równoległe podpięcia tej samej
 * grupy przechodzą oba sprawdzenia, zanim którekolwiek zapisze wiersz.
 * `ON DELETE CASCADE` sprząta mapowanie automatycznie przy usunięciu roli —
 * grupa w OpenWebUI NIE jest wtedy kasowana (D7), tylko opróżniana z
 * członków w warstwie serwisowej PRZED usunięciem wiersza roli.
 */
export const openwebuiGroupMappings = systemConfig.table("openwebui_group_mappings", {
  roleId: uuid("role_id")
    .primaryKey()
    .references(() => roles.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull().unique(),
  // Kopia dla czytelności w UI — NIGDY klucz dopasowania (patrz `groupId`).
  groupName: text("group_name").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  // NULL = ostatnie uzgodnienie się powiodło (albo jeszcze się nie odbyło).
  lastSyncError: text("last_sync_error"),
  createdAt,
  updatedAt,
})

/**
 * Ustawienia całej instancji — DOKŁADNIE JEDEN WIERSZ, po kolumnie na
 * ustawienie. Pierwsze i na razie jedyne: domyślny preset wyglądu
 * (PROJECT/cortex-frontend/ARTIFACTS/cortex-frontend-presety-wygladu-projekt.md
 * §5e, noga instancji).
 *
 * ODRZUCONA TABELA KLUCZ-WARTOŚĆ (`settings(key, value)`), bo to nie jest
 * kwestia gustu — te dwa kształty różnią się w trzech konkretnych miejscach:
 *
 *  1. „NIEUSTAWIONE" to tu stan LEGALNY, nie brak danych. W kolumnie
 *     nullowalnej ma dokładnie jedną reprezentację. W tabeli klucz-wartość ma
 *     trzy (brak wiersza, wiersz z NULL-em, wiersz z pustym napisem), o
 *     których rozstrzyga każdy piszący z osobna — a odczyt musi zgadywać.
 *  2. Zbiór ustawień jest ZAMKNIĘTY i produktowy, nie rozszerzalny przez
 *     użytkownika. Kolumny wypisują go w schemacie; klucze żyłyby wyłącznie w
 *     kodzie, więc nic nie powstrzymuje dwóch funkcji przed użyciem
 *     `appearance_preset` i `appearance.preset` obok siebie.
 *  3. Typ. `$inferSelect` daje serwisowi wiersz z polami; `Record<string,
 *     string>` kazałby każdemu konsumentowi zawężać wartość u siebie.
 *
 * Jedyne, co kupuje klucz-wartość, to „bez migracji na nowe ustawienie" —
 * a migracje są w tym repo tanie i pilnowane testem parzystości
 * (scripts/migrations-journal-parity.test.ts). Zła wymiana.
 *
 * SINGLETON PILNOWANY W BAZIE, nie w kodzie: `id boolean` z CHECK-iem na
 * prawdę dopuszcza co najwyżej jeden wiersz (drugi łamie klucz główny).
 * Bez tego „ustawienie instancji" jest wieloznaczne przy pierwszym `insert`
 * bez `on conflict`, a odczyt z `limit 1` wybiera arbitralnie — cicho.
 *
 * BEZ CHECK-a NA WARTOŚĆ `appearance_preset`, i to też jest decyzja. Lista
 * presetów żyje w rejestrze aplikacji (`app/idp/lib/presets/registry.ts`),
 * więc ograniczenie w bazie oznaczałoby migrację przy każdym nowym presecie i
 * zabetonowanie kodu w schemacie. Preset skasowany z rejestru zostawia tu
 * martwy identyfikator — świadomie: `resolvePresetId()` traktuje nieznaną
 * wartość jak brak wyboru (pola `PresetSources` są typu `string` dokładnie z
 * tego powodu), więc instancja spada na wartość domyślną zamiast się wywrócić.
 */
export const instanceSettings = systemConfig.table(
  "instance_settings",
  {
    id: boolean("id").primaryKey().default(true),
    // NULL = instancja nie narzuca wyglądu; wygrywa wybór użytkownika, a po
    // nim DEFAULT_PRESET. To jest stan domyślny każdej świeżej instancji.
    appearancePreset: text("appearance_preset"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    singleton: check("instance_settings_singleton", sql`${table.id}`),
  }),
)

export type UserRow = typeof users.$inferSelect
export type RoleRow = typeof roles.$inferSelect
export type ApplicationRow = typeof applications.$inferSelect
export type ApplicationTranslationRow = typeof applicationTranslations.$inferSelect
export type ApplicationScopeRow = typeof applicationScopes.$inferSelect
export type OpenwebuiGroupMappingRow = typeof openwebuiGroupMappings.$inferSelect
export type InstanceSettingsRow = typeof instanceSettings.$inferSelect
