import { z } from "zod"

// `kind` to jedyna dozwolona odpowiedź na "jak kafelek jest hostowany".
// native       — strona w tym Next.js app (patrz code-tile).
// external-link — link/target=_blank do zewnętrznego serwisu (np. OpenWebUI).
// iframe        — jak wyżej, ale osadzone w chrome shellu (Faza 2, jeszcze nieużywane).
export const TileKind = z.enum(["native", "external-link", "iframe"])
export type TileKind = z.infer<typeof TileKind>

/** Adres zewnętrzny musi być realnym linkiem HTTP(S). `z.string().url()` tego
 *  NIE pilnuje — przepuszcza `javascript:`/`data:`/`file:`, czyli uśpiony stored
 *  XSS na moment, w którym rejestr zacznie zasilać nawigację.
 *  Przeniesione z @cortex/service (PROJECT/cortex-frontend-hub-db-driven-projekt.md
 *  D10-rewizja a) — tile-sdk jest teraz jedynym miejscem, `service` importuje z powrotem. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Ścieżka natywna musi być ścieżką W TEJ aplikacji: jeden wiodący ukośnik,
 *  bez `//evil.com` (protocol-relative), bez `/\evil.com` (część przeglądarek
 *  traktuje backslash jak ukośnik) i bez pełnych URL-i — inaczej rejestr staje
 *  się open redirectem. */
export function isInternalRoute(value: string): boolean {
  return /^\/(?![/\\])\S*$/.test(value)
}

// Rozszerzenie o `route` (PROJECT/cortex-frontend-hub-db-driven-projekt.md
// D10-rewizja a): kafelki natywne nie miały dotąd w manifeście pola na trasę,
// mimo że to one są jedynym przypadkiem, który D6-rewizja musi obsłużyć —
// manifest jest DOWODEM, że kod istnieje, `route` jest częścią tego dowodu.
export const TileManifestSchema = z
  .object({
    id: z.string().min(1),
    kind: TileKind,
    label: z.string().min(1),
    // Ten sam regex/limit co `applications.code` w bazie (unique index + CHECK) —
    // walidacja tutaj, w miejscu gdzie deweloper pisze manifest, daje czytelny
    // błąd defineTile() zamiast błędu Postgresa dopiero przy deployu.
    entitlementCode: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "entitlementCode może zawierać tylko małe litery, cyfry i myślnik"),
    url: z.string().url().optional(),
    route: z.string().optional(),
  })
  .refine((tile) => tile.kind !== "native" || Boolean(tile.route), {
    message: "route wymagane dla kind='native'",
    path: ["route"],
  })
  .refine((tile) => tile.kind === "native" || Boolean(tile.url), {
    message: "url wymagane dla kind!=='native'",
    path: ["url"],
  })
  .refine((tile) => tile.kind !== "native" || !tile.url, {
    message: "kind='native' nie może mieć url",
    path: ["url"],
  })
  .refine((tile) => tile.kind === "native" || !tile.route, {
    message: "kind!=='native' nie może mieć route",
    path: ["route"],
  })
  .refine((tile) => !tile.route || isInternalRoute(tile.route), {
    message: "route musi być wewnętrzną ścieżką zaczynającą się od pojedynczego /",
    path: ["route"],
  })

export type TileManifest = z.infer<typeof TileManifestSchema>

// Jedyny sposób zdefiniowania kafelka — patrz .claude/skills/code-tile/SKILL.md.
// Rzuca przy błędnym manifeście zamiast cicho przepuszczać złe dane dalej.
export function defineTile(manifest: TileManifest): TileManifest {
  return TileManifestSchema.parse(manifest)
}
