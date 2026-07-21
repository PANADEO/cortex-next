import { buildSkillCatalog } from "@/features/cortex-cowork/server/skills-catalog"
import { readGovernanceConfig } from "@/lib/cortex-governance/store"
import { NextResponse } from "next/server"

/** The resolved skill catalog (all sources), for skill pickers. */
export async function GET(): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  return NextResponse.json(await buildSkillCatalog(config))
}
