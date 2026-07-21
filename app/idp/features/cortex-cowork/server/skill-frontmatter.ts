import type { CoworkSkillId, CoworkSkillSummary } from "../types"

/**
 * Minimal SKILL.md frontmatter reader. Flue's skill spec only requires `name`
 * and `description` as single-line YAML scalars, so a full YAML parser is
 * unnecessary for this prototype.
 */
export function parseSkillFrontmatter(raw: string): CoworkSkillSummary | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const block = match[1] ?? ""
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  if (!name || !description) return null
  return { id: name as CoworkSkillId, name, description }
}
