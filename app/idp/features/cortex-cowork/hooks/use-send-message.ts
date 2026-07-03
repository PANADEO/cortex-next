"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { ChatMessage, CoworkSession } from "../types"

function pendingUserMessage(content: string): ChatMessage {
  return {
    id: `pending-${Date.now()}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  }
}

export function useSendCoworkMessage(sessionId: string) {
  const client = useQueryClient()
  const queryKey = coworkQueryKeys.session(sessionId)

  return useMutation({
    mutationFn: (content: string) => coworkApi.sendMessage(sessionId, content),
    onMutate: async (content: string) => {
      await client.cancelQueries({ queryKey })
      const previous = client.getQueryData<CoworkSession>(queryKey)
      client.setQueryData<CoworkSession | undefined>(queryKey, (session) =>
        session
          ? { ...session, messages: [...session.messages, pendingUserMessage(content)] }
          : session,
      )
      return { previous }
    },
    onError: (_error, _content, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous)
    },
    onSuccess: (result) => {
      client.setQueryData<CoworkSession | undefined>(queryKey, (session) =>
        session
          ? {
              ...session,
              messages: [...session.messages, result.message],
              artifacts: [...session.artifacts, ...result.artifacts],
            }
          : session,
      )
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: coworkQueryKeys.artifacts(sessionId) })
    },
  })
}
