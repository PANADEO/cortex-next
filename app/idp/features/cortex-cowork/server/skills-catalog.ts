import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import type { CoworkCatalogSkill, CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { grantMatches } from "@cortex/types"
import type { CoworkSkillSummary } from "../types"
import { parseSkillFrontmatter } from "./skill-frontmatter"

/** A discovered skill plus where to copy it from (source folder + dir name). */
export interface ResolvedSkill extends CoworkCatalogSkill {
  sourceFolder: string
  dirName: string
}

/** Scans one folder for `<dir>/SKILL.md` packages, parsing each frontmatter. */
async function scanSkillFolder(
  folder: string,
): Promise<Array<{ summary: CoworkSkillSummary; dirName: string }>> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  const found: Array<{ summary: CoworkSkillSummary; dirName: string }> = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const raw = await readFile(path.join(folder, entry.name, "SKILL.md"), "utf8").catch(() => null)
    if (!raw) continue
    const summary = parseSkillFrontmatter(raw)
    if (summary) found.push({ summary, dirName: entry.name })
  }
  return found
}

/**
 * Resolves every skill the config's sources expose, tagged with its department
 * and copy origin. First writer wins on duplicate skill ids across sources
 * (logged) so the catalog stays a set. This is the disk-backed half of the
 * departmental catalog; the pure grant math lives in @cortex/types.
 */
export async function resolveSkillCatalog(
  config: CoworkGovernanceConfig,
): Promise<ResolvedSkill[]> {
  const byId = new Map<string, ResolvedSkill>()
  for (const source of config.skillSources) {
    const skills = await scanSkillFolder(source.folderPath)
    for (const { summary, dirName } of skills) {
      if (byId.has(summary.id)) {
        console.warn(
          `[cortex-cowork] duplicate skill id "${summary.id}" (source ${source.id}) - keeping first`,
        )
        continue
      }
      byId.set(summary.id, {
        id: summary.id,
        name: summary.name,
        description: summary.description,
        department: source.department,
        sourceId: source.id,
        sourceFolder: source.folderPath,
        dirName,
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Catalog skills for the admin UI (no disk-copy detail). */
export async function buildSkillCatalog(
  config: CoworkGovernanceConfig,
): Promise<CoworkCatalogSkill[]> {
  const resolved = await resolveSkillCatalog(config)
  return resolved.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    department: skill.department,
    sourceId: skill.sourceId,
  }))
}

/** Skills a project's composition grants (resolved, ready to copy). */
export async function resolveGrantedSkills(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
): Promise<ResolvedSkill[]> {
  const catalog = await resolveSkillCatalog(config)
  return catalog.filter((skill) =>
    grantMatches(project.composition.skills, { id: skill.id, department: skill.department }),
  )
}
