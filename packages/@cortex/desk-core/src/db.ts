import { Pool } from 'pg'

declare global { var __deskPool: Pool | undefined; var __deskMigracja: Promise<void> | undefined }

export const pool =
  global.__deskPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
if (process.env.NODE_ENV !== 'production') global.__deskPool = pool

/**
 * Migracja idempotentna. Schemat `desk` — konwencja „schemat per moduł".
 *
 * Memoizacja siedzi na `globalThis`, nie w module: w trybie dev Next tworzy osobną instancję
 * modułu dla każdej skompilowanej trasy, więc zmienna modułowa pozwoliłaby reaperowi odpalić
 * się ponownie i ubić turę, która właśnie trwa.
 */
export function migracja(): Promise<void> {
  if (global.__deskMigracja) return global.__deskMigracja
  const gotowe = (async () => {
    await pool.query(`
      create schema if not exists desk;

      create table if not exists desk.sprawa (
        id text primary key,
        wlasciciel text not null,
        tytul text not null,
        stan text not null default 'nowa',
        powod text,
        koszt_usd numeric not null default 0,
        utworzona timestamptz not null default now(),
        zmieniona timestamptz not null default now()
      );
      create index if not exists sprawa_wlasciciel_idx on desk.sprawa (wlasciciel, zmieniona desc);

      create table if not exists desk.zdarzenie (
        seq bigserial primary key,
        sprawa_id text not null references desk.sprawa(id) on delete cascade,
        at timestamptz not null default now(),
        payload jsonb not null
      );
      create index if not exists zdarzenie_sprawa_idx on desk.zdarzenie (sprawa_id, seq);

      create table if not exists desk.dziennik (
        id bigserial primary key,
        at timestamptz not null default now(),
        kto text not null,
        typ text not null,
        szczegoly jsonb not null default '{}'::jsonb
      );
      create index if not exists dziennik_at_idx on desk.dziennik (at desc);

      create table if not exists desk.prosba (
        id bigserial primary key,
        at timestamptz not null default now(),
        kto text not null,
        zdolnosc text not null,
        stan text not null default 'oczekuje'
      );
      alter table desk.prosba add column if not exists rozpatrzona timestamptz;
      alter table desk.prosba add column if not exists rozpatrzyl text;
      alter table desk.prosba add column if not exists uzasadnienie text;

      -- Nadanie zdolności ponad to, co daje rola. Katalog i role zostają w pliku seed,
      -- ale to, co ktoś dostał indywidualnie, musi przeżyć restart i mieć autora.
      -- Katalog serwerów MCP i przyjętych z nich narzędzi. Świadomie DWIE tabele:
      -- serwer dodaje się raz, a zgoda dotyczy POJEDYNCZEGO narzędzia i ma własnego
      -- autora, własny odcisk i własny stan. Zgoda na serwer jako całość byłaby zgodą
      -- na wszystko, co ten serwer kiedykolwiek wystawi.
      create table if not exists desk.serwer_mcp (
        nazwa text primary key,
        etykieta text not null,
        url text not null,
        dodal text not null,
        at timestamptz not null default now()
      );

      create table if not exists desk.narzedzie_mcp (
        serwer text not null references desk.serwer_mcp(nazwa) on delete cascade,
        nazwa_zdalna text not null,
        -- opis po polsku, napisany przez zatwierdzającego; jedyny tekst o tym narzędziu,
        -- który widzi model, i dlatego wchodzi do odcisku
        opis text not null,
        krotko text not null,
        zdolnosc text not null,
        odcisk text not null,
        -- 'zatwierdzone' | 'wstrzymane' (serwer zmienił narzędzie po zgodzie)
        stan text not null default 'zatwierdzone',
        powod text,
        zatwierdzil text not null,
        at timestamptz not null default now(),
        primary key (serwer, nazwa_zdalna)
      );

      create table if not exists desk.grant (
        kto text not null,
        zdolnosc text not null,
        nadal text not null,
        at timestamptz not null default now(),
        primary key (kto, zdolnosc)
      );
    `)
    // Reaper: tura przerwana restartem procesu nie może zostać „pracuje" na zawsze.
    // Ruszamy WYŁĄCZNIE sprawy bez śladu życia od dwóch minut — inaczej start drugiej
    // instancji zabijałby pracę, którą pierwsza właśnie wykonuje.
    const r = await pool.query(
      `update desk.sprawa s set stan='przerwane', powod='przerwane restartem serwera'
       where s.stan='pracuje'
         and coalesce(
               (select max(z.at) from desk.zdarzenie z where z.sprawa_id = s.id),
               s.zmieniona
             ) < now() - interval '2 minutes'
       returning s.id`,
    )
    if (r.rowCount) console.log(`[desk] reaper: ${r.rowCount} spraw odwieszonych po restarcie`)
  })()
  global.__deskMigracja = gotowe
  return gotowe
}
