"use client"

import { SourceEditorScreen } from "@/features/cortex-config"
import { useParams } from "next/navigation"

export default function EditSkillSourcePage() {
  const params = useParams<{ sourceId: string }>()
  return <SourceEditorScreen sourceId={params.sourceId} />
}
