// @vitest-environment jsdom
import { downloadBlob } from "@/lib/download"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildMailtoHref,
  createMailExportFile,
  getMailExportMimeType,
  openMailExport,
} from "./mail-export"

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}))

const originalShare = navigator.share
const originalCanShare = navigator.canShare

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(navigator, "share", { configurable: true, value: originalShare })
  Object.defineProperty(navigator, "canShare", { configurable: true, value: originalCanShare })
})

describe("mail export", () => {
  it("uses the extension MIME type when the backend returns a generic blob", () => {
    const blob = new Blob(["a,b"], { type: "application/octet-stream" })

    expect(getMailExportMimeType(blob, "invoice_default.csv")).toBe("text/csv")
    expect(createMailExportFile(blob, "invoice_default.csv").type).toBe("text/csv")
  })

  it("preserves a specific backend MIME type", () => {
    const blob = new Blob(["{}"], { type: "application/vnd.custom+json" })

    expect(getMailExportMimeType(blob, "invoice_default.json")).toBe("application/vnd.custom+json")
  })

  it("shares only files so Windows targets receive an attachment payload", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare })

    await expect(openMailExport(new Blob(["x"]), "invoice_default.xml")).resolves.toBe("shared")

    const shareData = { files: [expect.any(File)] }
    expect(canShare).toHaveBeenCalledWith(shareData)
    expect(share).toHaveBeenCalledWith(shareData)
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it("falls back to download plus mailto when a share target denies the file", async () => {
    const blob = new Blob(["<xml />"])
    const share = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"))
    const canShare = vi.fn().mockReturnValue(true)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare })

    await expect(openMailExport(blob, "invoice_default.xml")).resolves.toBe("downloaded-mailto")

    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] })
    expect(downloadBlob).toHaveBeenCalledWith(blob, "invoice_default.xml")
  })

  it("keeps a user-canceled share as an abort instead of downloading", async () => {
    const blob = new Blob(["x"])
    const share = vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError"))
    const canShare = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare })

    await expect(openMailExport(blob, "invoice_default.csv")).rejects.toMatchObject({ name: "AbortError" })

    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it("keeps the mailto fallback minimal", () => {
    expect(buildMailtoHref("invoice default.csv")).toBe("mailto:?subject=invoice+default.csv")
  })
})
