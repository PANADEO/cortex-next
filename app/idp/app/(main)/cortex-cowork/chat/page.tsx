"use client"

import {
  ArtifactsPanel,
  ChatPanel,
  coworkApi,
  useCoworkArtifacts,
  useCoworkSession,
  useEnsureCoworkSession,
  useSendCoworkMessage,
} from "@/features/cortex-cowork"
import { ErrorState, PageHeader } from "@cortex/ui"

export default function CortexCoworkChatPage() {
  const { sessionId, error, retry } = useEnsureCoworkSession()
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
        title="Cortex Cowork"
        description="Chat with a skills-powered agent that works inside a sandbox and hands you back files."
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
        />
      </div>
    </>
  )
}
