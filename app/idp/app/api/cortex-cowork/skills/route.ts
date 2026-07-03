import { listSkillCatalog } from "@/features/cortex-cowork/server/skills-catalog"
import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  const skills = await listSkillCatalog()
  return NextResponse.json(skills)
}
