import { randomUUID } from "node:crypto"
import type { ChatMessage, CoworkArtifact } from "../types"
import { appendMessage, registerArtifact, type SandboxSession } from "./sandbox-store"
import { generateCsvExport } from "./skills/csv-export"
import { generateExcelReport } from "./skills/excel-report"

/**
 * PoC BOUNDARY - this function stands in for a live Flue agent turn.
 *
 * In a real integration this becomes an `invoke()` of the `cowork-turn`
 * workflow defined in `../agent/cowork-workflow.ts`:
 *
 *   const { result } = await invoke("cowork-turn", {
 *     input: { message: userContent },
 *     wait: "result",
 *   })
 *
 * That workflow drives `harness.session().prompt(userContent)` against the
 * agent's copied skills + `local()` sandbox, and the model decides which
 * skill (if any) to run and what it writes under `artifacts/`. See
 * `../agent/` for that (unwired) real Flue code and why it isn't compiled
 * here yet.
 *
 * This stand-in approximates the same behavior with keyword routing so the
 * end-to-end chat -> sandbox -> downloadable file flow is fully demonstrable
 * without a live LLM call or the `@flue/runtime` dependency installed. The
 * file-writing skill implementations it calls (`./skills/*`) are real.
 */
export async function runChatTurn(
  session: SandboxSession,
  userContent: string,
): Promise<{ message: ChatMessage; artifacts: CoworkArtifact[] }> {
  const wantsCsv = /\bcsv\b/i.test(userContent)
  const wantsExcel = !wantsCsv && /excel|xlsx|arkusz|spreadsheet|raport|report/i.test(userContent)

  const newArtifacts: CoworkArtifact[] = []
  let replyLines: string[]

  if (wantsExcel) {
    const artifact = await generateExcelReport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "Loaded the excel-report skill and generated a workbook in the sandbox.",
      `Ready: ${artifact.filename} - grab it from the Artifacts panel.`,
    ]
  } else if (wantsCsv) {
    const artifact = await generateCsvExport(session, userContent)
    newArtifacts.push(artifact)
    replyLines = [
      "Loaded the csv-export skill and wrote a CSV in the sandbox.",
      `Ready: ${artifact.filename} - grab it from the Artifacts panel.`,
    ]
  } else {
    replyLines = [
      "I work inside this session's sandbox and hand you back real files.",
      `Loaded skills: ${session.skills.map((skill) => skill.name).join(", ") || "none"}.`,
      'Ask for "an excel report" or "a csv export" and I will generate one you can download.',
    ]
  }

  for (const artifact of newArtifacts) {
    await registerArtifact(session, artifact)
  }

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: replyLines.join("\n\n"),
    createdAt: new Date().toISOString(),
    ...(newArtifacts[0] ? { skillInvoked: newArtifacts[0].skill } : {}),
  }
  await appendMessage(session, message)

  return { message, artifacts: newArtifacts }
}
