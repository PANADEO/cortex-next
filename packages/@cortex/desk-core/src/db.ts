import { Pool } from "pg"
import seedUsers from "../seed/users.json"

// `var`, nie `let` — w `declare global` deklaracja MUSI trafić na `globalThis`, a `let`
// tworzy tam binding leksykalny, po którym `global.__deskPool` już nie sięgnie. To jedyne
// miejsce w tym repozytorium, gdzie `var` jest poprawną odpowiedzią, a nie zaniedbaniem.
/* eslint-disable no-var */
declare global {
  var __deskPool: Pool | undefined
  var __deskMigration: Promise<void> | undefined
}
/* eslint-enable no-var */

export const pool =
  global.__deskPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
if (process.env.NODE_ENV !== "production") global.__deskPool = pool

/**
 * Migracja idempotentna. Schemat `desk` — konwencja „schemat per moduł".
 *
 * Memoizacja siedzi na `globalThis`, nie w module: w trybie dev Next tworzy osobną instancję
 * modułu dla każdej skompilowanej trasy, więc zmienna modułowa pozwoliłaby reaperowi odpalić
 * się ponownie i ubić turę, która właśnie trwa.
 */
/**
 * Przemianowanie schematu na angielski — jednorazowe, idempotentne, PRZED tworzeniem tabel.
 *
 * Kolejność jest tu regułą, nie stylem: gdyby `create table if not exists` poszło pierwsze,
 * baza sprzed zmiany dostałaby DRUGI komplet tabel — pustych — a stare dane zostałyby
 * w tabelach, po które już nikt nie sięga. Objawem byłoby puste biurko, nie błąd.
 *
 * Nazwy wartości też są danymi: `stan='nowa'` i `typ='turn.start'` siedzą w kolumnach i w
 * `payload`, więc bez przepisania ich starych spraw nie dałoby się otworzyć, a przebieg
 * odtworzyłby się jako „czynność spoza katalogu". To jest dokładnie ten cichy brak dowodu,
 * przed którym broni ten produkt — i dlatego migrate idzie razem z przemianowaniem, a nie
 * „kiedyś potem".
 */
async function renameSchemaObjects() {
  await pool.query(`
    do $$
    begin
      if to_regclass('desk.sprawa') is not null then
        alter table desk.sprawa rename column wlasciciel to owner;
        alter table desk.sprawa rename column tytul to title;
        alter table desk.sprawa rename column stan to status;
        alter table desk.sprawa rename column powod to reason;
        alter table desk.sprawa rename column koszt_usd to cost_usd;
        alter table desk.sprawa rename column utworzona to created_at;
        alter table desk.sprawa rename column zmieniona to updated_at;
        alter index if exists desk.sprawa_wlasciciel_idx rename to case_file_owner_idx;
        alter table desk.sprawa rename to case_file;
      end if;

      if to_regclass('desk.zdarzenie') is not null then
        alter table desk.zdarzenie rename column sprawa_id to case_id;
        alter index if exists desk.zdarzenie_sprawa_idx rename to event_case_idx;
        alter table desk.zdarzenie rename to event;
      end if;

      if to_regclass('desk.dziennik') is not null then
        alter table desk.dziennik rename column kto to who;
        alter table desk.dziennik rename column typ to type;
        alter table desk.dziennik rename column szczegoly to details;
        alter index if exists desk.dziennik_at_idx rename to audit_log_at_idx;
        alter table desk.dziennik rename to audit_log;
      end if;

      if to_regclass('desk.prosba') is not null then
        alter table desk.prosba rename column kto to who;
        alter table desk.prosba rename column zdolnosc to capability;
        alter table desk.prosba rename column stan to status;
        alter table desk.prosba rename column rozpatrzona to decided_at;
        alter table desk.prosba rename column rozpatrzyl to decided_by;
        alter table desk.prosba rename column uzasadnienie to justification;
        alter table desk.prosba rename to access_request;
      end if;

      -- Tabela narzędzi wisi na kluczu obcym do tabeli serwerów, więc kolumnę
      -- serwer_mcp.nazwa przemianowujemy PRZED nią; Postgres przenosi zależność sam.
      if to_regclass('desk.serwer_mcp') is not null then
        alter table desk.serwer_mcp rename column nazwa to name;
        alter table desk.serwer_mcp rename column etykieta to label;
        alter table desk.serwer_mcp rename column dodal to added_by;
        alter table desk.serwer_mcp rename to mcp_server;
      end if;

      if to_regclass('desk.narzedzie_mcp') is not null then
        alter table desk.narzedzie_mcp rename column serwer to server;
        alter table desk.narzedzie_mcp rename column nazwa_zdalna to remote_name;
        alter table desk.narzedzie_mcp rename column opis to description;
        alter table desk.narzedzie_mcp rename column krotko to short_label;
        alter table desk.narzedzie_mcp rename column zdolnosc to capability;
        alter table desk.narzedzie_mcp rename column odcisk to fingerprint;
        alter table desk.narzedzie_mcp rename column stan to status;
        alter table desk.narzedzie_mcp rename column powod to reason;
        alter table desk.narzedzie_mcp rename column zatwierdzil to approved_by;
        alter table desk.narzedzie_mcp rename to mcp_tool;
      end if;

      -- Nazwy ograniczeń nie jadą za tabelą: rename tabeli zostawia ograniczenie
      -- sprawa_pkey przy tabeli case_file. Zmieniamy je osobno, bo to jedyne
      -- miejsce, w którym stara nazwa przeżyłaby całą migrację.
      if exists (select 1 from pg_constraint where conname='sprawa_pkey') then
        alter table desk.case_file rename constraint sprawa_pkey to case_file_pkey;
      end if;
      if exists (select 1 from pg_constraint where conname='zdarzenie_pkey') then
        alter table desk.event rename constraint zdarzenie_pkey to event_pkey;
      end if;
      if exists (select 1 from pg_constraint where conname='dziennik_pkey') then
        alter table desk.audit_log rename constraint dziennik_pkey to audit_log_pkey;
      end if;
      if exists (select 1 from pg_constraint where conname='prosba_pkey') then
        alter table desk.access_request rename constraint prosba_pkey to access_request_pkey;
      end if;
      if exists (select 1 from pg_constraint where conname='serwer_mcp_pkey') then
        alter table desk.mcp_server rename constraint serwer_mcp_pkey to mcp_server_pkey;
      end if;
      if exists (select 1 from pg_constraint where conname='narzedzie_mcp_pkey') then
        alter table desk.mcp_tool rename constraint narzedzie_mcp_pkey to mcp_tool_pkey;
      end if;

      -- Klucze obce mają własne nazwy i też ich nie niesie przemianowanie tabeli. Nie widzi
      -- ich żaden ekran, ale widzi je każdy, kto zajrzy do bazy — a wtedy polska nazwa
      -- ograniczenia mówi, że przemianowanie było niepełne.
      if exists (select 1 from pg_constraint where conname='narzedzie_mcp_serwer_fkey') then
        alter table desk.mcp_tool rename constraint narzedzie_mcp_serwer_fkey to mcp_tool_server_fkey;
      end if;
      if exists (select 1 from pg_constraint where conname='zdarzenie_sprawa_id_fkey') then
        alter table desk.event rename constraint zdarzenie_sprawa_id_fkey to event_case_id_fkey;
      end if;

      -- Tabela grant nazywała się tak od początku; przemianowania wymagają tylko kolumny.
      if exists (select 1 from information_schema.columns
                 where table_schema='desk' and table_name='grant' and column_name='kto') then
        alter table desk.grant rename column kto to who;
        alter table desk.grant rename column zdolnosc to capability;
        alter table desk.grant rename column nadal to granted_by;
      end if;
    end $$;
  `)
}

/**
 * Wartości utrwalone w kolumnach i w `payload`. Idą PO utworzeniu tabel, nie przed:
 * na świeżej bazie tabel jeszcze nie ma, a `update` na nieistniejącej tabeli to błąd,
 * nie brak zmian. Przemianowanie schematu musi być odwrotnie — stąd dwie funkcje, nie jedna.
 *
 * Każda mapa jest pełna i jednokierunkowa: po przejściu stara nazwa nie pasuje już do
 * niczego, więc powtórzenie migracji jest bezpieczne.
 */
async function renameStoredValues() {
  // WARTOŚCI DOMYŚLNE KOLUMN nie jadą za `rename column`, a `create table if not exists`
  // nie dotknie tabeli, która już istnieje. Bez tych trzech linii stara baza po migracji
  // ma przepisane WSZYSTKIE wiersze, a mimo to każdy NOWY wiersz wpada z polskim stanem —
  // i to jest awaria widoczna dopiero na ekranie, nie w migracji.
  await pool.query(`
    alter table desk.case_file alter column status set default 'new';
    alter table desk.access_request alter column status set default 'pending';
    alter table desk.mcp_tool alter column status set default 'approved';
  `)

  await pool.query(`
    update desk.case_file set status = case status
      when 'nowa' then 'new' when 'pracuje' then 'working' when 'gotowe' then 'done'
      when 'przerwane' then 'stopped' when 'blad' then 'failed' else status end;

    update desk.access_request set status = case status
      when 'oczekuje' then 'pending' when 'przyznana' then 'granted'
      when 'odrzucona' then 'denied' else status end;

    update desk.mcp_tool set status = case status
      when 'zatwierdzone' then 'approved' when 'wstrzymane' then 'suspended' else status end;

    update desk.audit_log set type = case type
      when 'sprawa.utworzona' then 'case.created'
      when 'tura.start' then 'turn.start' when 'tura.koniec' then 'turn.end'
      when 'tura.stop' then 'turn.stopped' when 'tura.blad' then 'turn.failed'
      when 'prosba.o.dostep' then 'request.opened' when 'prosba.przyznana' then 'request.granted'
      when 'prosba.odrzucona' then 'request.denied' when 'prosba.inne' then 'request.other'
      when 'zdolnosc.cofnieta' then 'capability.revoked' when 'zdolnosc.brak' then 'capability.missing'
      when 'dostep.odrzucony' then 'access.denied'
      when 'pliki.wgranie' then 'files.upload' when 'pliki.kosz' then 'files.trash'
      when 'pliki.przywroc' then 'files.restore' when 'pliki.przenies' then 'files.move'
      when 'pliki.kopiuj' then 'files.copy' when 'pliki.katalog' then 'files.folder'
      when 'mcp.serwer.dodany' then 'mcp.server.added'
      when 'mcp.serwer.przejrzany' then 'mcp.server.inspected'
      when 'mcp.narzedzie.zatwierdzone' then 'mcp.tool.approved'
      when 'mcp.narzedzie.wycofane' then 'mcp.tool.withdrawn'
      when 'mcp.narzedzie.wstrzymane' then 'mcp.tool.suspended'
      when 'koszt.wyzerowany' then 'cost.reset'
      else type end;
  `)

  // Zdolności — ten sam identyfikator stoi w trzech tabelach i w pliku zasiewu.
  // `inne` nie jest zdolnością, tylko znacznikiem prośby spoza katalogu; przechodzi tą samą mapą.
  const CAPABILITIES = `(values
      ('pliki.lista','files.list'), ('pliki.czytaj','files.read'),
      ('dokument.zapisz','document.write'), ('dokument.sprawdz','document.verify'),
      ('pliki.zapisz','files.keep'), ('arkusz.zapisz','sheet.write'),
      ('kod.uruchom','code.run'), ('obraz.generuj','image.generate'),
      ('kontrahent.sprawdz','counterparty.verify'), ('inne','other'))`

  await pool.query(`
    with mapa(stara, nowa) as ${CAPABILITIES}
    update desk.grant g set capability = m.nowa from mapa m where g.capability = m.stara;
  `)
  await pool.query(`
    with mapa(stara, nowa) as ${CAPABILITIES}
    update desk.access_request r set capability = m.nowa from mapa m where r.capability = m.stara;
  `)
  await pool.query(`
    with mapa(stara, nowa) as ${CAPABILITIES}
    update desk.mcp_tool t set capability = m.nowa from mapa m where t.capability = m.stara;
  `)

  // Wartości w `details`: identyfikator zdolności stoi tam raz pojedynczo (`zdolnosc`),
  // raz w tablicy (`zdolnosci`), a obok siedzą akcja na plikach i źródło kosztu. Bez tego
  // dziennik audytora nazywałby po polsku rzeczy, których katalog już tak nie nazywa.
  await pool.query(`
    with mapa(stara, nowa) as ${CAPABILITIES}
    update desk.audit_log a set details = jsonb_set(a.details, '{zdolnosc}', to_jsonb(m.nowa))
    from mapa m where a.details ->> 'zdolnosc' = m.stara;
  `)
  await pool.query(`
    update desk.audit_log a set details = jsonb_set(a.details, '{zdolnosci}', (
      select coalesce(jsonb_agg(coalesce(m.nowa, e.stara)), '[]'::jsonb)
      from jsonb_array_elements_text(a.details -> 'zdolnosci') as e(stara)
      left join (select * from ${CAPABILITIES} as t(stara, nowa)) m on m.stara = e.stara
    ))
    where jsonb_typeof(a.details -> 'zdolnosci') = 'array';
  `)
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{skadKoszt}',
      to_jsonb(case details ->> 'skadKoszt'
        when 'dostawca' then 'provider' when 'oszacowanie' then 'estimate'
        else details ->> 'skadKoszt' end))
    where details ? 'skadKoszt';
  `)
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{akcja}',
      to_jsonb(case details ->> 'akcja'
        when 'katalog' then 'folder' when 'kosz' then 'trash'
        when 'przywroc' then 'restore' when 'przenies' then 'move'
        when 'kopiuj' then 'copy' else details ->> 'akcja' end))
    where details ? 'akcja';
  `)

  // Wpisy dziennika o konektorze niosą jego slug i nazwę narzędzia jako WARTOŚCI.
  // Nietknięte, opisywałyby czynność nazwą, której katalog już nie zna.
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{serwer}', to_jsonb('vat-registry'::text))
    where details ->> 'serwer' = 'biala-lista';
  `)
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{narzedzie}', to_jsonb(
      case details ->> 'narzedzie'
        when 'sprawdz_nip' then 'vat_status'
        when 'sprawdz_rachunek' then 'bank_account_check'
        else details ->> 'narzedzie' end))
    where details ? 'narzedzie';
  `)
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{nazwa}', to_jsonb('vat-registry'::text))
    where type = 'mcp.server.added' and details ->> 'nazwa' = 'biala-lista';
  `)

  // Klucze `details` dziennika — ta sama zasada co w `payload` zdarzeń. Wpis `pliki.<akcja>`
  // zapisywał CAŁE ciało żądania, więc w mapie stoją też pola formularza plików.
  await pool.query(`
    update desk.audit_log set details = (
      select jsonb_object_agg(
        case k
          when 'sprawaId' then 'caseId' when 'odcisk' then 'fingerprint'
          when 'zdolnosc' then 'capability' when 'zdolnosci' then 'capabilities'
          when 'kosztUsd' then 'costUsd' when 'skadKoszt' then 'costBasis'
          when 'powod' then 'reason' when 'komu' then 'toWhom'
          when 'opis' then 'description' when 'nazwa' then 'name' when 'serwer' then 'server'
          when 'narzedzie' then 'tool' when 'narzedzi' then 'toolCount'
          when 'rozmiar' then 'size' when 'gdzie' then 'target' when 'co' then 'what'
          when 'spraw' then 'cases' when 'sciezka' then 'path'
          when 'akcja' then 'action' when 'z' then 'from' when 'do' then 'to'
          when 'kiedy' then 'when'
          -- surowy i gdyKolizja nie były w pierwszej wersji tej mapy, bo obu nie widać
          -- w żadnym wywołaniu audit.write — pierwszy dopisuje treść wyjątku przy błędzie
          -- tury, drugi wjeżdża CAŁYM ciałem żądania plików. Klucz, którego nikt nie wpisał
          -- z ręki, jest dokładnie tym, który wypada z mapy pisanej z czytania kodu.
          when 'surowy' then 'raw' when 'gdyKolizja' then 'onCollision' else k end,
        v)
      from jsonb_each(details) as pole(k, v)
    )
    where details ?| array['sprawaId','odcisk','zdolnosc','zdolnosci','kosztUsd','skadKoszt',
                           'powod','komu','opis','nazwa','serwer','narzedzie','narzedzi',
                           'rozmiar','gdzie','co','spraw','sciezka','akcja','z','do','kiedy',
                           'surowy','gdyKolizja'];
  `)

  // Wartość przy `onCollision` jest decyzją użytkownika, nie tekstem — i też się zmieniła.
  await pool.query(`
    update desk.audit_log set details = jsonb_set(details, '{onCollision}',
      to_jsonb(case details ->> 'onCollision'
        when 'blad' then 'error' when 'obie' then 'both'
        else details ->> 'onCollision' end))
    where details ? 'onCollision';
  `)

  // Nazwy narzędzi i nazwy ich argumentów też są kodem, więc też się zmieniły. Stare
  // zdarzenie z nazwą `zapisz_dokument` trafiłoby na gałąź „czynność spoza katalogu",
  // a przebieg pokazałby surowy klucz zamiast zdania — dokładnie ta cicha utrata dowodu.
  await pool.query(`
    with mapa(stara, nowa) as (values
      ('lista_plikow','list_files'), ('czytaj_plik','read_file'),
      ('zapisz_dokument','write_document'), ('sprawdz_dokument','verify_document'),
      ('zapisz_do_moich_plikow','save_to_my_files'), ('zapisz_arkusz','write_sheet'),
      ('uruchom_obliczenia','run_computation'), ('generuj_obraz','generate_image'),
      ('zglos_brak','report_gap'))
    update desk.event e set payload = jsonb_set(e.payload, '{nazwa}', to_jsonb(m.nowa))
    from mapa m where e.payload ->> 'nazwa' = m.stara;
  `)
  await pool.query(`
    update desk.event set payload = jsonb_set(payload, '{argumenty}', (
      select coalesce(jsonb_object_agg(
        case k when 'katalog' then 'folder' when 'sciezka' then 'path'
               when 'nazwa' then 'name' when 'cel' then 'target'
               when 'opis' then 'description' else k end, v), '{}'::jsonb)
      from jsonb_each(payload -> 'argumenty') as pole(k, v)
    ))
    where jsonb_typeof(payload -> 'argumenty') = 'object';
  `)

  // Konektor „biała lista" jest NASZ, więc jego slug i nazwy narzędzi zmieniły się razem
  // z resztą kodu. Odcisk obejmuje DOKŁADNIE te dwie nazwy, więc jedzie w tym samym kroku:
  // inaczej straż przed dryfem wstrzymałaby narzędzie za zmianę, której serwer nie zrobił.
  //
  // Slug brzmi `biala-lista` i tylko tak. Pierwsze wydanie tej migracji szukało `biala-list`,
  // bo zbiorcza podmiana `lista`→`list` zjadła ogon w literałach SQL. Skutek: migracja nie
  // trafiała w ani jeden wiersz, zasiew zakładał `vat-registry` OBOK nietkniętej `biala-listy`,
  // a klient MCP szedł do starego serwera po `sprawdz_nip` — którego ten serwer już nie
  // wystawia. Pracownik dostawał komunikat o dryfie zamiast wyniku. Dlatego poniżej jest
  // SCALENIE, nie samo przemianowanie: każda baza, która to wydanie uruchomiła, stoi dziś
  // z dwoma serwerami naraz i musi z tego wyjść przy najbliższym starcie.
  //
  // Kolejność jest regułą: nazwy narzędzi zmieniamy JESZCZE POD starym serwerem, bo klucz
  // główny to (server, remote_name) — przeniesienie najpierw wepchnęłoby `sprawdz_nip` obok
  // `vat_status`, a przemianowanie zaraz potem złamałoby klucz i wywaliło start aplikacji.
  await pool.query(`
    update desk.mcp_tool t set remote_name = m.nowa, fingerprint = m.odcisk
    from (values
      ('sprawdz_nip', 'vat_status',
       '5c8b05965afd3c3d2994872d4fb9fc70fa20486b30d5edaebb87d882b0ed51e3'),
      ('sprawdz_rachunek', 'bank_account_check',
       '19c8a3199bbd49bac72fdf5db8b254ce1e7e537288971e9f036c893cbcccf693')
    ) as m(stara, nowa, odcisk)
    where t.server='biala-lista' and t.remote_name = m.stara;
  `)

  // Wstrzymanie znaczy „nie, dopóki człowiek nie obejrzy". Scalenie dwóch wierszy w jeden
  // nie może tej decyzji zgubić, więc jeśli którykolwiek był wstrzymany, wstrzymany zostaje
  // ten, który przeżyje. Odwrotnie byłoby cichym przywróceniem cofniętej zgody.
  await pool.query(`
    update desk.mcp_tool o set status='suspended', reason=coalesce(o.reason, t.reason)
    from desk.mcp_tool t
    where o.server='biala-lista' and t.server='vat-registry'
      and t.remote_name = o.remote_name and t.status='suspended';
  `)

  // Wiersz pod `vat-registry` mógł powstać wyłącznie z zasiewu po nietrafionej migracji —
  // prawdziwa zgoda człowieka wisi pod starym slugiem, razem z jego nazwiskiem i datą.
  // Zasiew ustępuje; podpis zostaje.
  await pool.query(`
    delete from desk.mcp_tool t
    where t.server='vat-registry'
      and exists (select 1 from desk.mcp_tool o
                  where o.server='biala-lista' and o.remote_name = t.remote_name);
  `)

  // Klucz obcy nie ma `on update cascade`, więc nowy wiersz serwera powstaje obok starego,
  // narzędzia przechodzą na niego, a stary wiersz znika.
  await pool.query(`
    insert into desk.mcp_server (name, label, url, added_by, at)
    select 'vat-registry', label, url, added_by, at from desk.mcp_server where name='biala-lista'
    on conflict (name) do nothing;
  `)
  await pool.query(`update desk.mcp_tool set server='vat-registry' where server='biala-lista';`)
  await pool.query(`delete from desk.mcp_server where name='biala-lista';`)
  await pool.query(`
    update desk.event set payload = jsonb_set(payload, '{nazwa}', to_jsonb(
      case payload ->> 'nazwa'
        when 'mcp_biala_lista_sprawdz_nip' then 'mcp_vat_registry_vat_status'
        when 'mcp_biala_lista_sprawdz_rachunek' then 'mcp_vat_registry_bank_account_check'
        else payload ->> 'nazwa' end))
    where payload ->> 'nazwa' like 'mcp_biala_lista_%';
  `)

  // Zdarzenie „zablokowane" niesie identyfikator zdolności — ten sam, który przed chwilą
  // zmienił się w katalogu i w tabelach. Pominięty, kazałby kłódce w przebiegu prosić
  // o zdolność, której katalog już nie zna.
  await pool.query(`
    with mapa(stara, nowa) as ${CAPABILITIES}
    update desk.event e set payload = jsonb_set(e.payload, '{zdolnoscId}', to_jsonb(m.nowa))
    from mapa m where e.payload ->> 'zdolnoscId' = m.stara;
  `)

  // `payload` zdarzeń: nazwa wariantu, nazwy pól i wartości pól dyskryminujących.
  // Bez tego przebieg starej sprawy odtworzyłby się jako czynność spoza katalogu.
  await pool.query(`
    update desk.event set payload = (
      select jsonb_object_agg(
        case k
          when 'typ' then 'type' when 'tekst' then 'text' when 'nazwy' then 'names'
          when 'etykieta' then 'label' when 'argumenty' then 'args'
          when 'podsumowanie' then 'summary' when 'zrodlo' then 'source'
          when 'opis' then 'description' when 'zdolnoscId' then 'capabilityId'
          when 'dzial' then 'department' when 'skad' then 'basis' when 'powod' then 'reason'
          when 'nazwa' then 'name' when 'stan' then 'status'
          when 'zalaczniki' then 'attachments' else k end,
        case
          when k = 'typ' then to_jsonb(case v #>> '{}'
            when 'mysl' then 'prompt' when 'zalacznik' then 'attachment'
            when 'narzedzie_start' then 'tool_start' when 'narzedzie_koniec' then 'tool_end'
            when 'zablokowane' then 'blocked' when 'koszt' then 'cost' else v #>> '{}' end)
          when k = 'stan' then to_jsonb(case v #>> '{}'
            when 'koniec' then 'end' when 'przerwane' then 'stopped' when 'blad' then 'failed'
            else v #>> '{}' end)
          when k = 'skad' then to_jsonb(case v #>> '{}'
            when 'dostawca' then 'provider' when 'oszacowanie' then 'estimate'
            else v #>> '{}' end)
          else v end)
      from jsonb_each(payload) as pole(k, v)
    )
    where payload ?| array['typ','tekst','nazwy','etykieta','argumenty','podsumowanie',
                           'zrodlo','opis','zdolnoscId','dzial','skad','powod','nazwa',
                           'stan','zalaczniki'];
  `)
}

/**
 * Persony demonstracji wsypane do tabeli osób. `on conflict do nothing`, bo po pierwszym
 * uruchomieniu właścicielem roli i działu jest przełożony, a nie plik: zasiew, który
 * nadpisywałby wiersz przy każdym starcie, cofałby jego decyzje przy każdym wdrożeniu.
 *
 * Adres składamy z domeny WDROŻENIA — tak samo, jak robi to `identity.ts`.
 */
async function seedPeople() {
  const domain = (process.env.DESK_DOMAIN ?? "itsg.pl").trim().toLowerCase()
  for (const u of seedUsers.users) {
    await pool.query(
      `insert into desk.person (id, email, first_name, last_name, department, role)
       values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
      [u.id, `${u.id}@${domain}`, u.firstName, u.lastName, u.department, u.role],
    )
  }
}

export function migrate(): Promise<void> {
  if (global.__deskMigration) return global.__deskMigration
  const ready = (async () => {
    await renameSchemaObjects()
    await pool.query(`
      create schema if not exists desk;

      create table if not exists desk.case_file (
        id text primary key,
        owner text not null,
        title text not null,
        status text not null default 'new',
        reason text,
        cost_usd numeric not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists case_file_owner_idx on desk.case_file (owner, updated_at desc);

      create table if not exists desk.event (
        seq bigserial primary key,
        case_id text not null references desk.case_file(id) on delete cascade,
        at timestamptz not null default now(),
        payload jsonb not null
      );
      create index if not exists event_case_idx on desk.event (case_id, seq);
      -- Pochodzenie pliku w „Moich plikach" czyta się ze zdarzeń (patrz file-origin.ts).
      -- Bez tego indeksu jest to przegląd WSZYSTKICH zdarzeń tej osoby przy każdym
      -- otwarciu ekranu plików, a zdarzeń przybywa z każdą turą rozmowy.
      create index if not exists event_stored_file_idx
        on desk.event ((payload->>'summary'))
        where payload->>'name' = 'save_to_my_files';
      -- Dzienny limit pyta o zdarzenia kosztu z DZISIAJ (capability-gate.ts). Bez tego
      -- indeksu jest to przegląd wszystkich zdarzeń w bazie przed KAŻDYM zleceniem —
      -- a zdarzeń przybywa z każdą turą każdej osoby, więc koszt rośnie z wiekiem wdrożenia.
      create index if not exists event_cost_idx
        on desk.event (at)
        where payload->>'type' = 'cost';

      create table if not exists desk.audit_log (
        id bigserial primary key,
        at timestamptz not null default now(),
        who text not null,
        type text not null,
        details jsonb not null default '{}'::jsonb
      );
      create index if not exists audit_log_at_idx on desk.audit_log (at desc);

      create table if not exists desk.access_request (
        id bigserial primary key,
        at timestamptz not null default now(),
        who text not null,
        capability text not null,
        status text not null default 'pending'
      );
      alter table desk.access_request add column if not exists decided_at timestamptz;
      alter table desk.access_request add column if not exists decided_by text;
      alter table desk.access_request add column if not exists justification text;

      -- Katalog serwerów MCP i przyjętych z nich narzędzi. Świadomie DWIE tabele:
      -- server dodaje się raz, a zgoda dotyczy POJEDYNCZEGO narzędzia i ma własnego
      -- autora, własny fingerprint i własny status. Zgoda na server jako całość byłaby zgodą
      -- na wszystko, co ten server kiedykolwiek wystawi.
      create table if not exists desk.mcp_server (
        name text primary key,
        label text not null,
        url text not null,
        added_by text not null,
        at timestamptz not null default now()
      );

      create table if not exists desk.mcp_tool (
        server text not null references desk.mcp_server(name) on delete cascade,
        remote_name text not null,
        -- description po polsku, napisany przez zatwierdzającego; jedyny tekst o tym narzędziu,
        -- który widzi model, i dlatego wchodzi do odcisku
        description text not null,
        short_label text not null,
        capability text not null,
        fingerprint text not null,
        -- 'approved' | 'suspended' (server zmienił narzędzie po zgodzie)
        status text not null default 'approved',
        reason text,
        approved_by text not null,
        at timestamptz not null default now(),
        primary key (server, remote_name)
      );

      -- OSOBA JEST WIERSZEM, nie wpisem w pliku. Zasiew person zostaje jako stan
      -- początkowy demonstracji, ale przestaje być jedynym źródłem: przy pierwszym
      -- wejściu z bramy logowania zakłada się tu konto, bo inaczej u klienta weszłyby
      -- na Biurko dokładnie dwie osoby, a reszta firmy dostałaby wyjątek.
      create table if not exists desk.person (
        id text primary key,
        email text not null unique,
        first_name text not null,
        last_name text not null,
        department text not null default '',
        role text not null default 'member',
        -- Limit dzienny per OSOBA. Pusto znaczy „bierz z roli" i to jest wartość
        -- domyślna: rola opisuje typową sytuację, a wyjątek dotyczy jednej osoby,
        -- nie wszystkich o tej samej roli.
        daily_limit_usd numeric,
        created_at timestamptz not null default now()
      );

      -- SPRAWA WE DWOJE. Domyślnie sprawy nie widzi nikt poza właścicielem i to jest
      -- dobra reguła — brakowało od niej JAKIEGOKOLWIEK wyjątku, więc dowód, który jest
      -- całą wartością tego produktu, kończył się na granicy jednego biurka.
      --
      -- Udostępnia WŁAŚCICIEL, nigdy przełożony: wgląd w treść cudzej pracy to co innego
      -- niż nadzór nad zakresem uprawnień, a „prywatna przestrzeń pracy" przestałaby
      -- cokolwiek znaczyć, gdyby przełożony mógł sobie otworzyć każdą sprawę.
      create table if not exists desk.case_share (
        case_id text not null references desk.case_file(id) on delete cascade,
        who text not null,
        shared_by text not null,
        at timestamptz not null default now(),
        primary key (case_id, who)
      );
      create index if not exists case_share_who_idx on desk.case_share (who, at desc);

      -- Rozmowa LUDZI przy sprawie. Osobna tabela, nie desk.event, i to nie jest
      -- kwestia porządku: zdarzenia sprawy jadą do modelu jako historia, więc komentarz
      -- wrzucony do tego strumienia stałby się poleceniem dla agenta. Nikt tego nie
      -- zamawiał, a zrobienie tego źle jest o połowę krótsze niż zrobienie dobrze.
      create table if not exists desk.case_message (
        id bigserial primary key,
        case_id text not null references desk.case_file(id) on delete cascade,
        who text not null,
        text text not null,
        at timestamptz not null default now()
      );
      create index if not exists case_message_idx on desk.case_message (case_id, id);

      -- PAMIĘĆ ASYSTENTA. Prywatna przestrzeń tej osoby, tak samo jak „Moje pliki":
      -- przełożony widzi w dzienniku, że ktoś coś przyjął albo skasował, ale nigdy
      -- treści. Wpis z treścią zamieniłby ekran nadzoru w podgląd cudzych notatek.
      --
      -- Skasowane wspomnienia znikają, nie idą do kosza: kosz w prywatnej przestrzeni
      -- udawałby, że człowiek czegoś nie skasował.
      create table if not exists desk.memory (
        id bigserial primary key,
        owner text not null,
        text text not null,
        -- 'proposed' (asystent zaproponował) | 'kept' (człowiek przyjął albo wpisał sam)
        status text not null default 'kept',
        source_case_id text,
        created_at timestamptz not null default now(),
        decided_at timestamptz
      );
      create index if not exists memory_owner_idx on desk.memory (owner, created_at);

      -- Kolumny dokładane do tabeli, która JUŻ istnieje: create table if not exists
      -- ich nie doda. Ta sama zasada, co przy access_request.
      alter table desk.person add column if not exists daily_limit_usd numeric;
      -- Odejście z firmy. Konto ZOSTAJE, bo jego sprawy, dziennik i nadania są dowodem,
      -- którego nie kasuje się razem z człowiekiem. Wyłączone konto po prostu nie wchodzi.
      alter table desk.person add column if not exists active boolean not null default true;

      -- Nadanie zdolności ponad to, co daje rola. Katalog i role zostają w pliku seed,
      -- ale to, co ktoś dostał indywidualnie, musi przeżyć restart i mieć autora.
      create table if not exists desk.grant (
        who text not null,
        capability text not null,
        granted_by text not null,
        at timestamptz not null default now(),
        primary key (who, capability)
      );
    `)
    await renameStoredValues()
    await seedPeople()
    // Reaper: tura przerwana restartem procesu nie może zostać „pracuje" na zawsze.
    // Ruszamy WYŁĄCZNIE sprawy bez śladu życia od dwóch minut — inaczej start drugiej
    // instancji zabijałby pracę, którą pierwsza właśnie wykonuje.
    const r = await pool.query(
      `update desk.case_file c set status='stopped', reason='przerwane restartem serwera'
       where c.status='working'
         and coalesce(
               (select max(e.at) from desk.event e where e.case_id = c.id),
               c.updated_at
             ) < now() - interval '2 minutes'
       returning c.id`,
    )
    // Zakaz `console` pilnuje kodu lecącego do PRZEGLĄDARKI. To jest proces serwerowy,
    // a odwieszenie spraw po restarcie musi zostawić ślad — inaczej nikt nie wie, że
    // czyjaś praca została przerwana nie przez agenta, tylko przez wdrożenie.
    // eslint-disable-next-line no-console
    if (r.rowCount) console.log(`[desk] reaper: ${r.rowCount} spraw odwieszonych po restarcie`)
  })()
  global.__deskMigration = ready
  return ready
}
