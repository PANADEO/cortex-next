#!/usr/bin/env node
// Triggers a daily "Okna czasowe" scan against a running Cortex Frontend instance.
// Intended to be invoked by cron. See app/idp/app/(main)/okna-czasowe/log for the in-app
// info panel documenting the schedule; this script is the executable half of that doc.
//
// Usage:
//   OKNA_CZASOWE_BASE_URL=https://cortex-frontend.example.com node scripts/okna-czasowe-scan.mjs
//
// Defaults to http://localhost:3000 for local/dev use.

const baseUrl = process.env.OKNA_CZASOWE_BASE_URL ?? "http://localhost:3000"
const url = `${baseUrl.replace(/\/+$/, "")}/api/okna-czasowe/scan`

const startedAt = new Date().toISOString()
console.log(`[okna-czasowe-scan] ${startedAt} POST ${url}`)

try {
  const response = await fetch(url, { method: "POST" })
  const body = await response.json()

  if (!response.ok) {
    console.error(`[okna-czasowe-scan] failed: HTTP ${response.status}`, body)
    process.exit(1)
  }

  console.log(
    `[okna-czasowe-scan] done: ${body.log.filmsScanned} films scanned, ` +
      `${body.log.newAvailabilities} new availabilities, ${body.log.errors.length} errors`,
  )
  if (body.log.errors.length > 0) {
    console.error("[okna-czasowe-scan] errors:", body.log.errors)
    process.exit(1)
  }
} catch (error) {
  console.error("[okna-czasowe-scan] request failed:", error)
  process.exit(1)
}
