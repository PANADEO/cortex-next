import { describe, expect, it } from "vitest"
import { detectIntakeKind, isEmailFile, isZipFile } from "./file-intake"

function makeFile(name: string) {
  return new File(["test"], name)
}

describe("file intake", () => {
  it("detects a single zip as a zip bundle", () => {
    expect(detectIntakeKind([makeFile("package.zip")])).toBe("zip")
    expect(isZipFile(makeFile("PACKAGE.ZIP"))).toBe(true)
  })

  it("detects a single eml or msg as an email container", () => {
    expect(detectIntakeKind([makeFile("message.eml")])).toBe("email")
    expect(detectIntakeKind([makeFile("outlook.MSG")])).toBe("email")
    expect(isEmailFile(makeFile("message.eml"))).toBe(true)
  })

  it("treats regular files and multi-file selections as loose files", () => {
    expect(detectIntakeKind([makeFile("invoice.pdf")])).toBe("loose")
    expect(detectIntakeKind([makeFile("message.eml"), makeFile("invoice.pdf")])).toBe("loose")
  })
})
