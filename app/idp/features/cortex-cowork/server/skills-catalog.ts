import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { CoworkSkillSummary } from "../types"
import { parseSkillFrontmatter } from "./skill-frontmatter"

// The canonical skills package, copied into every new sandbox session.
export const SKILLS_SOURCE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "skills",
)

/**
 * Reads the skill catalog from a skills directory (defaults to the canonical
 * source). Sandbox sessions pass their own copied `skillsDir` so the reported
 * catalog reflects what was actually copied in, not just the source.
 */
export async function listSkillCatalog(
  skillsDir: string = SKILLS_SOURCE_DIR,
): Promise<CoworkSkillSummary[]> {
  const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => [])
  const summaries: CoworkSkillSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const raw = await readFile(path.join(skillsDir, entry.name, "SKILL.md"), "utf8").catch(
      () => null,
    )
    if (!raw) continue
    const parsed = parseSkillFrontmatter(raw)
    if (parsed) summaries.push(parsed)
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name))
}
