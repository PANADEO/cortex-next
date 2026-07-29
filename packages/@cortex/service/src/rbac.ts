// RBAC jako wewnętrzny serwis (nie HTTP) — jedyne miejsce, z którego code-api
// wolno wywołać sprawdzenie dostępu. Pełny kontrakt: REFERENCE.md obok
// .claude/skills/code-service/SKILL.md.
//
// STAN DZIŚ: NIE ZAIMPLEMENTOWANE. Istniejący, działający wzorzec (do
// czasu przeniesienia na @cortex/db) żyje w
// app/idp/app/api/_lib/access.ts (getAccessResult, woła zewnętrzny
// cortex-admin). Ta funkcja ma go zastąpić po zbudowaniu schematu
// `konfiguracja_systemu` w @cortex/db (Ścieżka E) — rzuca świadomie,
// żeby nikt przypadkiem nie założył, że już działa.

export interface TileAccessResult {
  allowed: boolean
  email: string | null
}

export async function requireTileAccess(
  _request: Request,
  _entitlementCode: string,
): Promise<TileAccessResult> {
  throw new Error(
    "requireTileAccess() nie jest jeszcze podłączone do @cortex/db — patrz code-service/REFERENCE.md. " +
      "Do czasu wdrożenia używaj app/idp/app/api/_lib/access.ts (getAccessResult).",
  )
}
