// Seed modułu Konfiguracja Systemu.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... ADMIN_EMAIL=ktos@firma.pl pnpm --filter @cortex/db db:seed
//
// Model: DEKLARACJA STANU DOCELOWEGO, nie jednorazowy bootstrap.
//
// TEN PLIK NIE JEST JUŻ REJESTREM APLIKACJI. Ręcznie utrzymywana lista
// APPLICATIONS (23 kody, ~290 linii) zniknęła w K3 — jedynym źródłem faktów o
// kafelku jest manifest (@cortex/tile-sdk defineTile()), a wiersze zakłada
// seed-tile-manifests.mjs, wcześniej w łańcuchu migrate. Zostają trzy rzeczy i
// żadna z nich nie opisuje kafelka; wszystkie opisują STAN TEJ INSTANCJI:
//
//   (1) aktywacja rdzenia (`system-config`) — bezwarunkowa,
//   (2) BOOTSTRAP_MODULES — wygodowa aktywacja przy pierwszym uruchomieniu,
//   (3) ADMIN_EMAIL — konto administratora, rola, granty.
//
// CO NAPRAWIŁO USUNIĘCIE LISTY. Oba defekty były żywe, nie teoretyczne:
//   B1 — pięć kolumn hub-renderu (show_on_hub/color/category_functional/
//        category_department/activated_at) stało w `on conflict do update`
//        BEZWARUNKOWO, więc kategoria zmieniona przez admina w UI wracała do
//        wartości z listy przy KAŻDYM deployu (odtworzone na żywo:
//        analytics/{marketing} -> misc/{operations}).
//   B3 — INSERT listy wstawiał `activated_at = now()` razem z domyślnym
//        `is_active = true`, więc świeża baza dostawała aktywny kafelek na
//        hubie także dla kodu, którego moduł wykluczono z buildu.
//
// `meeting-guru` ZNIKA RAZEM Z LISTĄ (D3): to kafelek `external-link`, czyli
// dane instancji zakładane z UI admina, a nie fakt kodu w tym repo (manifest
// byłby dowodem czegoś, czego tu nie ma). Świeża instancja nie dostaje już
// tego wiersza — link dodaje człowiek przez Konfiguracja Systemu -> Aplikacje
// -> Dodaj aplikację. Na instancjach istniejących wiersz zostaje nietknięty:
// ten seed jest addytywny i nigdy niczego nie usuwa.
//
// ─── (1) AKTYWACJA RDZENIA ───────────────────────────────────────────────
//
// seed-tile-manifests.mjs rejestruje KAŻDY kafelek jako nieaktywnego
// kandydata (`is_active=false, activated_at=null`) — to jest zamierzone,
// manifest zgłasza kandydata, nie włącza modułu. Jedynym miejscem, które
// cokolwiek aktywowało, był INSERT usuniętej listy. Bez zastępnika świeża
// baza kończyłaby z ZEREM aktywnych modułów, w tym `system-config` — a
// powłoka jest fail-closed i czyta `is_active`, więc administrator nie miałby
// dostępu do panelu administracyjnego, czyli do jedynego miejsca, z którego
// dałoby się cokolwiek włączyć. Zero ścieżki wyjścia z UI.
//
// To jest Ryzyko #1 z projektu licencjonowania i ta sama klasa błędu
// wystąpiła już raz w tym repo (Krok 1b hub-db-driven: na genuinnie pustej
// bazie `system-config` i 21 innych kafelków zostawało trwale
// `is_active=false`). Wariant A (decyzja Alexa, 07.08.2026): świeża instancja
// aktywuje z TEGO pliku wyłącznie rdzeń, resztę admin włącza świadomie.
//
// UWAGA — "wyłącznie rdzeń" NIE jest prawdą o całym łańcuchu migrate. Świeża
// instancja kończy z TRZEMA aktywnymi kafelkami: `system-config` stąd oraz
// `ilustromat` i `token-usage`, które AKTYWUJĄ SIĘ SAME w swoich seedach
// (seed-ilustromat.mjs / seed-token-usage.mjs, `update ... where activated_at
// is null` — ten sam wzorzec, biegną po tym skrypcie).
//
// FOLLOW-UP K3, nie ciekawostka: to jest dokładnie ta sama ręcznie
// utrzymywana lista aktywacji startowej, którą ten krok usuwa — tylko
// rozsypana po dwóch plikach zamiast stać w jednej tablicy. Każdy nowy moduł,
// który skopiuje ten wzorzec do własnego seeda, po cichu dokłada czwarty
// kafelek do "świeżej instalacji" i nikt tego nie zauważy, bo nie ma miejsca,
// w którym ta lista jest widoczna naraz. Docelowo o starcie modułu ma
// decydować BOOTSTRAP_MODULES (albo `licensing: "core"` z L1), a seedy
// modułowe mają wyłącznie grantować i wypełniać własne tabele. Nie robimy
// tego tutaj: to osobna zmiana ZACHOWANIA produktu i osobne review.
//
// RDZEŃ NIE PRZECHODZI przez ENABLED_MODULES i nigdy nie może. Bramka
// licencyjna odpowiada na "co ta instancja ma prawo mieć" i z założenia nie
// dotyczy modułów aktywowanych ani rdzenia platformy (module-licensing.ts,
// docs/local-run.md). Przepuszczenie rdzenia przez nią znaczyłoby, że
// `ENABLED_MODULES=content-guru` w konfiguracji deployu odcina administratora
// od panelu na świeżej instancji — czyli odtwarza Ryzyko #1, tylko przez
// pominięcie jednego kodu zamiast przez brak mechanizmu.
//
// Nieosiągalny rdzeń PRZERYWA seed i jest to JEDYNE miejsce w tym pliku,
// które przerywa. Powód jest odwrotny niż przy BOOTSTRAP_MODULES niżej: tam
// zatrzymanie łańcucha zostawiłoby instancję bez administratora, tu
// zatrzymanie łańcucha jest jedyną rzeczą, która GŁOŚNO powie, że instancja i
// tak by go nie miała. Lepiej, żeby `docker compose up` stanął na `migrate`
// (cortex-frontend czeka na `service_completed_successfully` i wtedy nie
// wstanie), niż żeby wstała instancja bez wyjścia z UI.
//
// ─── (2) BOOTSTRAP_MODULES ───────────────────────────────────────────────
//
// Lista kodów (comma-separated, ten sam wzorzec co ENABLED_MODULES) do
// włączenia przy PIERWSZYM uruchomieniu. Powód istnienia jest czysto
// praktyczny i tak został zgłoszony: wariant A w czystej postaci znaczy
// dwadzieścia kilka ręcznych kliknięć na każde nowe środowisko, a środowiska
// stawia się często.
//
// Trzy ograniczenia, wszystkie nośne:
//
//   * PRZECIĘCIE Z LICENCJĄ, nigdy suma — każdy kod przechodzi przez
//     isModuleEnabled() (module-licensing.mjs), dokładnie tak jak
//     activateApplication() w serwisie. Inaczej zmienna wygody byłaby
//     obejściem licencji na jeden wpis w `.env`, czyli odtworzeniem dziury
//     zamkniętej commitem `00f9a7c`.
//   * WYŁĄCZNIE wiersz z `activated_at is null` — ten sam guard co
//     activateApplication() i seed-ilustromat.mjs. Admin, który świadomie
//     WYŁĄCZYŁ moduł, nie dostaje go z powrotem przy najbliższym deployu.
//     Dokładnie ten błąd popełnia blok ADMIN_EMAIL niżej przy grantach i jest
//     to udokumentowana, świadomie przyjęta konsekwencja — tutaj jej NIE
//     POWTARZAMY.
//   * KOD NIELICENCJONOWANY ALBO NIEZNANY = pominięty z czytelnym logiem, nie
//     błąd. Seedy w `docker-compose*.yml` są spięte przez `&&`, więc rzucenie
//     na literówce w konfiguracji deployu zatrzymałoby łańcuch przed blokiem
//     administratora i zostawiło instancję bez konta admina.
//
// Zmienna zachowuje się jak `activateApplication()` z pickera, a nie jak
// deklaracja stanu docelowego — stąd `BOOTSTRAP_`, a nie `ACTIVE_`.
//
// Rozważone i odrzucone: (a) wartość `*` ("włącz wszystko, na co jest
// licencja") — wyglądałaby wygodnie, ale zmienna zostaje w konfiguracji
// deployu na stałe, więc znaczyłaby, że KAŻDY nowy moduł dodany w kolejnej
// wersji włącza się sam na istniejącej instancji przy najbliższym deployu; to
// już nie bootstrap, tylko zniesienie wariantu A. (b) eksport/import
// konfiguracji instancji z UI — mocniejsze, bo klonuje całe ustawienie
// klienta (kategorie, kolejność, kolory), ale to osobny byt z własnym
// formatem, wersjonowaniem i walidacją; zostaje na moment, w którym pojawi
// się potrzeba klonowania, a nie samego bootstrapu.
//
// ─── (3) ADMIN_EMAIL ─────────────────────────────────────────────────────
//
//   ADMIN_EMAIL USTAWIONE — przy KAŻDYM uruchomieniu seed zapewnia, że ten
//   DOKŁADNIE jeden adres ma: aktywne konto w `users` (zakłada je, jeśli nie
//   istnieje; REAKTYWUJE, jeśli było wyłączone), rolę `admin` i grant tej roli
//   do WSZYSTKICH aplikacji z rejestru. Bezwarunkowo. Seed NIE pyta, czy jest
//   już jakiś administrator, i nie zgaduje po kodzie roli — sprawdza tylko ten
//   adres.
//
//   ADMIN_EMAIL NIEUSTAWIONE — seed nie wykonuje tego bloku w ogóle. Nie
//   zakłada konta, nie nadaje roli, niczego nie sprawdza. Rdzeń i tak zostaje
//   aktywowany (jest potrzebny niezależnie od tego, kto jest adminem).
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
//
// KOLEJNOŚĆ W ŁAŃCUCHU MIGRATE: ten skrypt wymaga, żeby seed-tile-manifests.mjs
// biegł PRZED nim (docker-compose*.yml, strażnik seed-chain-parity.test.ts) —
// od K3 nie tylko po to, żeby granty admina objęły zarejestrowane kody, ale
// dlatego, że bez tamtego skryptu nie istnieje wiersz rdzenia, który ten
// aktywuje.

import postgres from "postgres"
import { bootstrapActivationPlan } from "./module-licensing.mjs"

const ADMIN_ROLE_CODE = "admin"

/** Kod modułu administracyjnego. Ten sam, po którym pyta bramka powłoki i
 *  którego `assertKeepsModuleReachable()` w @cortex/service broni przed
 *  dezaktywacją z UI — jedyny kod wymieniony w tym pliku z nazwy. */
const SYSTEM_CONFIG_APP_CODE = "system-config"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

const sql = postgres(databaseUrl, { max: 1 })

/** Włącza kandydata BEZ historii aktywacji. Warunki są 1:1 z
 *  activateApplication() (@cortex/service): `kind='native'` (wiersz
 *  `external-link`/`iframe` to dane instancji, nie kandydat z manifestu) oraz
 *  `activated_at is null` (decyzja admina o wyłączeniu modułu ma przeżyć
 *  deploy). Zwraca liczbę realnie włączonych wierszy — zero znaczy "warunki
 *  nie zaszły", nigdy "błąd". */
async function activateCandidate(tx, code) {
  const rows = await tx`
    update system_config.applications
    set is_active = true, activated_at = now(), updated_at = now()
    where code = ${code} and kind = 'native' and activated_at is null
    returning code
  `
  return rows.length
}

async function main() {
  await sql.begin(async (tx) => {
    const [role] = await tx`
      insert into system_config.roles (code, name, description, is_system)
      values (${ADMIN_ROLE_CODE}, 'Administrator', 'Pełny dostęp do konfiguracji systemu', true)
      on conflict (code) do update set is_system = true
      returning id
    `
    console.log(`[seed] rola ${ADMIN_ROLE_CODE}: ok`)

    // (1) Rdzeń. Poza BOOTSTRAP_MODULES i poza ENABLED_MODULES — patrz nagłówek.
    //
    // Czytamy STAN przed aktywacją, zamiast wnioskować z liczby zmienionych
    // wierszy: "UPDATE nie ruszył nic" znaczy zarówno "wiersz jest już
    // aktywowany" (norma na każdym kolejnym deployu), jak i "wiersza nie ma w
    // ogóle" (seed-tile-manifests.mjs nie biegł albo manifest wypadł z
    // barrela). Te dwa stany dzieli wszystko, więc muszą się różnić w logu.
    const [core] = await tx`
      select kind, is_active, activated_at
      from system_config.applications
      where code = ${SYSTEM_CONFIG_APP_CODE}
    `
    if (!core) {
      throw new Error(
        `Brak wiersza ${SYSTEM_CONFIG_APP_CODE} w system_config.applications — ` +
          "instancja nie miałaby dostępu do panelu administracyjnego, czyli do jedynego " +
          "miejsca, z którego dałoby się to naprawić. Sprawdź, czy seed-tile-manifests.mjs " +
          "biegł PRZED tym skryptem i czy manifest tego kafelka jest w barrelu " +
          "app/idp/lib/tile-manifests.ts.",
      )
    }
    if (core.activated_at === null) {
      // Ta sama dwuznaczność "UPDATE zmienił zero wierszy", o którą chodzi w
      // komentarzu wyżej, tylko po stronie ZAPISU: activateCandidate() wymaga
      // też `kind='native'`, więc wiersz rdzenia o innym typie przeszedłby
      // tędy bez żadnej zmiany, a w logu zostałoby "aktywowany" i exit 0.
      // Cichy sukces w JEDYNYM bloku tego pliku, którego zadaniem jest być
      // głośnym — dlatego wynik jest sprawdzany, nie porzucany.
      if ((await activateCandidate(tx, SYSTEM_CONFIG_APP_CODE)) === 0) {
        throw new Error(
          `Wiersz ${SYSTEM_CONFIG_APP_CODE} nigdy nie był aktywowany, ale nie da się go włączyć: ` +
            `nie jest kind='native' (jest '${core.kind}'). Instancja nie miałaby dostępu do panelu ` +
            "administracyjnego. Normalnie pilnuje tego seed-tile-manifests.mjs, który resynchronizuje " +
            "kind z manifestu przy każdym deployu — sprawdź, czy biegł PRZED tym skryptem.",
        )
      }
      console.log(`[seed] rdzeń ${SYSTEM_CONFIG_APP_CODE}: aktywowany (świeża instancja)`)
    } else if (core.is_active) {
      console.log(`[seed] rdzeń ${SYSTEM_CONFIG_APP_CODE}: aktywny, zostawiam`)
    } else {
      // Historia aktywacji jest, ale moduł jest wyłączony. UI tego nie
      // pozwala (assertKeepsModuleReachable w @cortex/service), więc taki stan
      // powstaje wyłącznie ręcznym SQL-em — i ten seed świadomie go NIE
      // naprawia, bo cofanie decyzji o wyłączeniu modułu jest dokładnie tym,
      // czego bootstrap ma nie robić. Zostaje głośne zatrzymanie deployu.
      throw new Error(
        `Wiersz ${SYSTEM_CONFIG_APP_CODE} ma is_active=false przy ustawionym activated_at — ` +
          "instancja nie miałaby dostępu do panelu administracyjnego, a ten seed świadomie nie " +
          "cofa wyłączenia modułu. Wymagana ręczna naprawa w bazie " +
          "(update system_config.applications set is_active = true where code = 'system-config').",
      )
    }

    // (2) BOOTSTRAP_MODULES. Przecięcie z ENABLED_MODULES policzone poza tym
    // plikiem, żeby dało się je przetestować bez bazy — module-licensing.mjs.
    const { activate, refused } = bootstrapActivationPlan()

    // Literówka bywa jednocześnie "spoza licencji" (bo nie ma jej w
    // ENABLED_MODULES) i "spoza rejestru". Bez tego zapytania gałąź o
    // literówce byłaby nieosiągalna dokładnie w konfiguracji, w której jest
    // najbardziej potrzebna — przy ustawionej liście licencyjnej.
    const unknown = new Set()
    for (const code of refused) {
      const [row] = await tx`
        select 1 as found from system_config.applications where code = ${code}
      `
      if (!row) unknown.add(code)
      console.warn(
        row
          ? `[seed] bootstrap: ${code} POMINIĘTY — kod spoza ENABLED_MODULES. ` +
              "BOOTSTRAP_MODULES nie poszerza licencji tej instancji."
          : `[seed] bootstrap: ${code} POMINIĘTY — nie ma takiego kodu ANI w rejestrze, ` +
              "ANI w ENABLED_MODULES (literówka w konfiguracji deployu?).",
      )
    }

    let bootstrapped = 0
    let skipped = 0
    for (const code of activate) {
      // Rdzeń na liście bootstrapowej nie jest błędem, tylko wpisem zbędnym —
      // został aktywowany kilkanaście linii wyżej, bezwarunkowo. Bez tej
      // gałęzi wpadłby w komunikat o "decyzji administratora o wyłączeniu
      // modułu", której nikt nie podjął: activated_at ustawił ten sam seed
      // przed chwilą.
      if (code === SYSTEM_CONFIG_APP_CODE) {
        skipped += 1
        console.warn(
          `[seed] bootstrap: ${code} POMINIĘTY — rdzeń aktywuje się bezwarunkowo, ` +
            "poza BOOTSTRAP_MODULES. Wpis na tej liście niczego nie zmienia.",
        )
        continue
      }

      if ((await activateCandidate(tx, code)) > 0) {
        bootstrapped += 1
        continue
      }

      skipped += 1
      const [existing] = await tx`
        select kind, activated_at from system_config.applications where code = ${code}
      `
      if (!existing) {
        console.warn(
          `[seed] bootstrap: ${code} POMINIĘTY — nie ma takiego kodu w rejestrze ` +
            "(literówka w konfiguracji deployu albo moduł wykluczony z tego buildu).",
        )
      } else if (existing.activated_at) {
        console.warn(
          `[seed] bootstrap: ${code} POMINIĘTY — moduł ma już historię aktywacji. ` +
            "Bootstrap nigdy nie cofa decyzji administratora o wyłączeniu modułu.",
        )
      } else {
        console.warn(
          `[seed] bootstrap: ${code} POMINIĘTY — wiersz nie jest kind='native' ` +
            `(jest '${existing.kind}'). Bootstrap dotyczy wyłącznie kafelków z manifestu.`,
        )
      }
    }

    // Kontener `migrate` kończy pracę i gaśnie, więc ten log jest JEDYNYM
    // kanałem zwrotnym o tym, co zmienna zrobiła. Dlatego wszystkie cztery
    // liczby, nie tylko sukcesy: "aktywowano 3" bez "pominięto 24" czyta się
    // jak potwierdzenie, że reszta listy była pusta.
    console.log(
      `[seed] bootstrap: ${activate.length + refused.length} kodów w BOOTSTRAP_MODULES — ` +
        `aktywowano ${bootstrapped}, pominięto ${skipped} (bez zmian), ` +
        `odmówiono ${refused.length} (poza licencją, w tym ${unknown.size} spoza rejestru)`,
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

    // Celowo "wszystkie wiersze w applications", nie "wszystkie wiersze
    // aktywne": administrator ma mieć grant także do kodów zarejestrowanych z
    // manifestu i jeszcze nieaktywowanych — inaczej po aktywacji z pickera
    // musiałby sobie dograć własny dostęp. Obejmuje też aplikacje dodane
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
