// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { buildImportForm } from "./endpoints"

describe("buildImportForm", () => {
  it("adds notification fields only when provided", () => {
    const withEmail = buildImportForm({
      file: new File(["zip"], "package.zip", { type: "application/zip" }),
      notification_email: "user@example.com",
      notification_export_template: "sad_xml",
    })
    const withoutEmail = buildImportForm({
      file: new File(["zip"], "package.zip", { type: "application/zip" }),
    })

    expect(withEmail.get("notification_email")).toBe("user@example.com")
    expect(withEmail.get("notification_export_template")).toBe("sad_xml")
    expect(withoutEmail.has("notification_email")).toBe(false)
    expect(withoutEmail.has("notification_export_template")).toBe(false)
  })
})
