import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { writeJsonAtomic } from "./json-file"

// Regression test for the shared-tmp-path race: two writers targeting the
// same logical JSON file used to share `${file}.tmp`, so a concurrent write
// could either throw ENOENT (rename racing an already-renamed-away tmp path)
// or leave the file with content lost/corrupted mid-flight. writeJsonAtomic
// must serialize concurrent writes to the same resolved path so both calls
// resolve cleanly and the file ends up as exactly one caller's payload.

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "json-file-race-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe("writeJsonAtomic concurrency", () => {
  it("serializes concurrent writes to the same path: both resolve, file is exactly one full payload", async () => {
    const file = path.join(dir, "governance.json")
    // Large-ish payload so writeFile isn't a single trivially-atomic syscall
    // and any interleaving in the shared tmp path has a real chance to show.
    const payloadA = { writer: "A", filler: "a".repeat(300_000) }
    const payloadB = { writer: "B", filler: "b".repeat(300_000) }
    const serializedA = JSON.stringify(payloadA, null, 2)
    const serializedB = JSON.stringify(payloadB, null, 2)

    const iterations = 25
    for (let i = 0; i < iterations; i++) {
      const results = await Promise.allSettled([
        writeJsonAtomic(file, payloadA),
        writeJsonAtomic(file, payloadB),
      ])

      for (const result of results) {
        expect(result.status).toBe("fulfilled")
      }

      const finalContent = await readFile(file, "utf8")
      const isExactlyOnePayload =
        finalContent === serializedA || finalContent === serializedB
      expect(
        isExactlyOnePayload,
        `iteration ${i}: file content was neither payload verbatim (length ${finalContent.length}, expected ${serializedA.length} or ${serializedB.length}) — likely interleaved/corrupted write`,
      ).toBe(true)
    }
  })
})
