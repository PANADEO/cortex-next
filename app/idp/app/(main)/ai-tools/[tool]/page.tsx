"use client"

import { AiToolWorkspace } from "@/components/ai-tools/ai-tool-workspace"
import { use } from "react"

interface AiToolPageProps {
  params: Promise<{
    tool: string
  }>
}

export default function AiToolPage({ params }: AiToolPageProps) {
  const { tool } = use(params)
  return <AiToolWorkspace toolId={tool} />
}
