"use client"

import { ConnectorEditorScreen } from "@/features/cortex-config"
import { useParams } from "next/navigation"

export default function EditConnectorPage() {
  const params = useParams<{ connectorId: string }>()
  return <ConnectorEditorScreen connectorId={params.connectorId} />
}
