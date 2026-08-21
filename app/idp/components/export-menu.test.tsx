/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ExportMenu } from "./export-menu"

const mocks = vi.hoisted(() => ({
  exportResult: vi.fn(),
  sendExportEmail: vi.fn(),
  toastApiError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}))

vi.mock("@cortex/api", () => ({
  endpoints: {
    packages: {
      exportResult: mocks.exportResult,
      sendExportEmail: mocks.sendExportEmail,
    },
  },
  toastApiError: mocks.toastApiError,
  useExportTemplates: () => ({
    isLoading: false,
    data: [
      {
        name: "sad_xml",
        display_name: "SAD XML",
        format: "xml",
        description: "SAD XML export",
      },
      {
        name: "standard_json",
        display_name: "Standard JSON",
        format: "json",
        description: "Standard JSON export",
      },
    ],
  }),
  useMe: () => ({ data: { email: "user@example.com" } }),
}))

function installLocalStorage(): void {
  const storage = new Map<string, string>()
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  })
}

describe("ExportMenu", () => {
  beforeEach(() => {
    installLocalStorage()
    mocks.exportResult.mockReset()
    mocks.sendExportEmail.mockReset()
    mocks.toastApiError.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.sendExportEmail.mockResolvedValue({
      sent_to: "user@example.com",
      file_name: "package_sad_xml.xml",
    })
  })

  it("opens email sending as a separate menu action without checkbox mode", async () => {
    const user = userEvent.setup()
    render(<ExportMenu packageId="pkg-1" fileName="package.zip" />)

    await user.click(screen.getByRole("button", { name: "Eksport" }))

    expect(screen.queryByRole("menuitemcheckbox", { name: "Email" })).toBeNull()

    await user.click(await screen.findByRole("menuitem", { name: /wyślij mailem/i }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Szablon eksportu")).toHaveTextContent("SAD XML")
    expect(screen.getByLabelText("Do")).toHaveValue("user@example.com")
  })

  it("sends export email through backend endpoint", async () => {
    const user = userEvent.setup()
    render(<ExportMenu packageId="pkg-1" fileName="package.zip" />)

    await user.click(screen.getByRole("button", { name: "Eksport" }))
    await user.click(await screen.findByRole("menuitem", { name: /wyślij mailem/i }))

    fireEvent.change(await screen.findByLabelText("Temat"), {
      target: { value: "Gotowy eksport" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Wyślij" }))

    await waitFor(() => {
      expect(mocks.sendExportEmail).toHaveBeenCalledWith("pkg-1", "sad_xml", {
        to_email: "user@example.com",
        subject: "Gotowy eksport",
        body: "W załączniku eksport.",
      })
    })
    expect(mocks.exportResult).not.toHaveBeenCalled()
  })
})
