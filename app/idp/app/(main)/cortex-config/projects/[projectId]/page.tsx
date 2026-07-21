"use client"

import { ProjectEditorScreen } from "@/features/cortex-config"
import { useParams } from "next/navigation"

export default function EditProjectPage() {
  const params = useParams<{ projectId: string }>()
  return <ProjectEditorScreen projectId={params.projectId} />
}
