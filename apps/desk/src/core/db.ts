import { Pool } from 'pg'

declare global { var __deskPool: Pool | undefined }

export const pool =
  global.__deskPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
if (process.env.NODE_ENV !== 'production') global.__deskPool = pool

let gotowe: Promise<void> | null = null

/** Migracja idempotentna. Schemat `desk` — konwencja „schemat per moduł". */
export function migracja(): Promise<void> {
  if (gotowe) return gotowe
  gotowe = (async () => {
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
    `)
    // Reaper: tura przerwana restartem procesu nie może zostać "pracuje" na zawsze.
    const r = await pool.query(
      `update desk.sprawa set stan='przerwane', powod='przerwane restartem serwera'
       where stan='pracuje' returning id`,
    )
    if (r.rowCount) console.log(`[desk] reaper: ${r.rowCount} spraw odwieszonych po restarcie`)
  })()
  return gotowe
}
