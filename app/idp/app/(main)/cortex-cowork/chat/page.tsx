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
  useSendCoworkMessage,
} from "@/features/cortex-cowork"
import { ErrorState, PageHeader } from "@cortex/ui"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function CortexCoworkChat() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project") ?? DEFAULT_COWORK_PROJECT_ID
  const { projects } = useCoworkProjectTiles()
  const project = projects.find((p) => p.id === projectId)

  const { sessionId, error, retry } = useEnsureCoworkSession(projectId)
  const sessionQuery = useCoworkSession(sessionId)
  const artifactsQuery = useCoworkArtifacts(sessionId)
  const sendMessage = useSendCoworkMessage(sessionId ?? "")

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
        title={project?.name ?? "Cortex Cowork"}
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
          {...(project?.exportEnabled && sessionId
            ? { onExport: (artifactId: string) => coworkApi.exportArtifact(sessionId, artifactId) }
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
