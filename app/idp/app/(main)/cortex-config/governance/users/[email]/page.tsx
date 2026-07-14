"use client"

import { AssignmentEditorScreen } from "@/features/cortex-config"
import { useParams } from "next/navigation"

export default function EditAssignmentPage() {
  const params = useParams<{ email: string }>()
  return <AssignmentEditorScreen email={decodeURIComponent(params.email)} />
}
