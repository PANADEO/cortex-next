"use client"

import { RoleEditorScreen } from "@/features/cortex-config"
import { useParams } from "next/navigation"

export default function EditRolePage() {
  const params = useParams<{ roleId: string }>()
  return <RoleEditorScreen roleId={params.roleId} />
}
