import { z } from "zod"

// `kind` to jedyna dozwolona odpowiedź na "jak kafelek jest hostowany".
// native       — strona w tym Next.js app (patrz code-tile).
// external-link — link/target=_blank do zewnętrznego serwisu (np. OpenWebUI).
// iframe        — jak wyżej, ale osadzone w chrome shellu (Faza 2, jeszcze nieużywane).
export const TileKind = z.enum(["native", "external-link", "iframe"])
export type TileKind = z.infer<typeof TileKind>

export const TileManifestSchema = z
  .object({
    id: z.string().min(1),
    kind: TileKind,
    label: z.string().min(1),
    entitlementCode: z.string().min(1),
    url: z.string().url().optional(),
  })
  .refine((tile) => tile.kind === "native" || Boolean(tile.url), {
    message: "url jest wymagane dla kind !== 'native'",
    path: ["url"],
  })

export type TileManifest = z.infer<typeof TileManifestSchema>

// Jedyny sposób zdefiniowania kafelka — patrz .claude/skills/code-tile/SKILL.md.
// Rzuca przy błędnym manifeście zamiast cicho przepuszczać złe dane dalej.
export function defineTile(manifest: TileManifest): TileManifest {
  return TileManifestSchema.parse(manifest)
}
