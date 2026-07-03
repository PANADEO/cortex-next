/* eslint-disable @typescript-eslint/ban-ts-comment -- see @ts-nocheck rationale below */
// @ts-nocheck
//
// PoC BOUNDARY (unwired). This is the real Flue agent definition, written
// against the documented @flue/runtime API (https://flueframework.com/docs -
// concepts/agents, guide/skills, guide/sandboxes). It is not compiled or
// executed by this build: `@flue/runtime` isn't installed, because this
// worktree's node_modules is a symlink shared with a sibling worktree
// building another tile in parallel, and running `npm install` here would
// touch that other build's environment mid-flight.
//
// To make this real: add `@flue/runtime` to package.json, run `npm install`,
// delete the `@ts-nocheck` line above, and wire `../server/chat-engine.ts` to
// call the `cowork-turn` workflow (see cowork-workflow.ts) instead of the
// keyword-routing stand-in it uses today.
import { defineAgent } from "@flue/runtime"
import { local } from "@flue/runtime/node"
import csvExport from "../skills/csv-export/SKILL.md" with { type: "skill" }
import excelReport from "../skills/excel-report/SKILL.md" with { type: "skill" }

export default defineAgent(() => ({
  model: "anthropic/claude-sonnet-4-6",
  instructions:
    "You are Cortex Cowork, an assistant that works inside a sandboxed workspace on " +
    "behalf of a Cortex360 user. Use your skills to turn requests into concrete files " +
    "under artifacts/ rather than just describing what you would do.",
  skills: [excelReport, csvExport],
  sandbox: local(),
  cwd: "/workspace",
}))
