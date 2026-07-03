/* eslint-disable @typescript-eslint/ban-ts-comment -- see @ts-nocheck rationale below */
// @ts-nocheck
//
// PoC BOUNDARY (unwired) - see cowork-agent.ts for why this isn't compiled.
//
// This is the real per-turn workflow: it lets the agent work a single prompt
// against its copied skills + local() sandbox and returns the reply text.
// Any file the model writes under artifacts/ during the run stays on disk in
// the session's sandboxDir, where `../server/sandbox-store.ts` already looks
// for artifacts today (it just doesn't call into Flue to produce them yet).
import { defineWorkflow } from "@flue/runtime"
import * as v from "valibot"
import agent from "./cowork-agent"

export default defineWorkflow({
  agent,
  input: v.object({ message: v.string() }),
  output: v.object({ reply: v.string() }),
  async run({ harness, input }) {
    const session = await harness.session()
    const reply = await session.prompt(input.message)
    return { reply }
  },
})
