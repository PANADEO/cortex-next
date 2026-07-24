import { streamChatTurn } from "@/features/cortex-cowork/server/chat-engine"
import { recordUserMessage } from "@/features/cortex-cowork/server/sandbox-store"
import { isDenied, requireSessionAccess } from "@/lib/cortex-governance/project-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface SendMessageBody {
  content?: unknown
}

const encoder = new TextEncoder()

function sseChunk(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * Streaming variant of POST /messages: emits the agent's live activity as
 * Server-Sent Events while the Flue runner works, then a terminal event.
 *
 *   event: activity  - one AgentActivityStep per event, as the agent works
 *   event: done      - { message, artifacts } (same payload as the plain POST)
 *   event: error     - { message } when the turn fails outright
 *
 * The non-streaming POST /messages route stays available as a fallback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate
  const { session, email } = gate

  const body = (await request.json().catch(() => null)) as SendMessageBody | null
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  if (!content) {
    return NextResponse.json({ message: "content is required" }, { status: 400 })
  }

  await recordUserMessage(session, content)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(sseChunk(event, data))
        } catch {
          closed = true // client went away mid-run; let the turn finish server-side
        }
      }

      streamChatTurn(session, content, (step) => send("activity", step), {
        userEmail: email,
      })
        .then((result) => {
          send("done", result)
        })
        .catch((error: unknown) => {
          send("error", { message: error instanceof Error ? error.message : String(error) })
        })
        .finally(() => {
          if (!closed) {
            closed = true
            try {
              controller.close()
            } catch {
              // already closed by the runtime
            }
          }
        })
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
