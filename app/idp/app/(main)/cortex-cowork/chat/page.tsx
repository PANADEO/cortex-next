"use client"

import {
  ArtifactsPanel,
  ChatPanel,
  coworkApi,
  DEFAULT_COWORK_PROJECT_ID,
  useCoworkArtifacts,
  useCoworkProjectTiles,
  useCoworkSession,
  useEnsureCoworkSession,
  useExportArtifact,
  useSendCoworkMessage,
} from "@/features/cortex-cowork"
import { ErrorState, PageHeader } from "@cortex/ui"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function CortexCoworkChat() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project") ?? DEFAULT_COWORK_PROJECT_ID
  const { tiles, projects } = useCoworkProjectTiles()
  const project = tiles.find((tile) => tile.id === projectId)
  const exportEnabled = projects.find((p) => p.id === projectId)?.exportEnabled ?? false

  const { sessionId, error, retry } = useEnsureCoworkSession(projectId)
  const sessionQuery = useCoworkSession(sessionId)
  const artifactsQuery = useCoworkArtifacts(sessionId)
  const sendMessage = useSendCoworkMessage(sessionId ?? "")
  const exportArtifact = useExportArtifact(sessionId)

  const messages = sessionQuery.data?.messages ?? []
  const artifacts = artifactsQuery.data ?? sessionQuery.data?.artifacts ?? []

  if (error) {
    return (
      <div className="p-8">
        <ErrorState
          title="Could not start a sandbox session"
          message={error.message}
          onRetry={retry}
        />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={project?.label ?? "Cortex Cowork"}
        description={
          project?.description ??
          "Chat with a skills-powered agent that works inside a sandbox and hands you back files."
        }
      />
      <div className="flex min-h-0 flex-1">
        <ChatPanel
          messages={messages}
          isSending={sendMessage.isPending}
          isLoadingSession={!sessionId || sessionQuery.isLoading}
          onSend={(content) => sendMessage.mutate(content)}
        />
        <ArtifactsPanel
          sessionId={sessionId}
          artifacts={artifacts}
          downloadHref={(artifactId) =>
            sessionId ? coworkApi.artifactDownloadHref(sessionId, artifactId) : "#"
          }
          {...(exportEnabled
            ? { onExport: (artifactId: string) => exportArtifact.mutateAsync(artifactId) }
            : {})}
        />
      </div>
    </>
  )
}

export default function CortexCoworkChatPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <CortexCoworkChat />
    </Suspense>
  )
}
