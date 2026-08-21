/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImportQueue } from "./import-queue"

const mocks = vi.hoisted(() => ({
  importPackage: vi.fn(),
  importEmail: vi.fn(),
  importMultiple: vi.fn(),
}))

vi.mock("@cortex/api", () => ({
  toastApiError: vi.fn(),
  useMe: () => ({ data: { email: "user@example.com" } }),
  useExportTemplates: () => ({
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
  useFeatureFlags: () => ({ data: {}, isSuccess: false }),
  useImportPackage: () => ({
    mutateAsync: mocks.importPackage,
    isPending: false,
  }),
  useImportEmailPackage: () => ({
    mutateAsync: mocks.importEmail,
    isPending: false,
  }),
  useImportMultiplePackages: () => ({
    mutateAsync: mocks.importMultiple,
    isPending: false,
  }),
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

describe("ImportQueue", () => {
  beforeEach(() => {
    installLocalStorage()
    mocks.importPackage.mockReset()
    mocks.importEmail.mockReset()
    mocks.importMultiple.mockReset()
    mocks.importPackage.mockResolvedValue({ id: "pkg-1" })
  })

  it("defaults notification email from current user and submits it with ZIP import", async () => {
    render(<ImportQueue />)

    fireEvent.click(screen.getByRole("checkbox", { name: "Wyślij wynik mailem po przetworzeniu" }))

    await waitFor(() => {
      expect(screen.getByDisplayValue("user@example.com")).not.toBeNull()
    })

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["zip"], "package.zip", { type: "application/zip" })],
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Importuj" }))

    await waitFor(() => expect(mocks.importPackage).toHaveBeenCalledTimes(1))
    expect(mocks.importPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_email: "user@example.com",
        notification_export_template: "sad_xml",
      }),
    )
    expect(
      window.localStorage.getItem("cortex.idp.export.emailRecipients:user@example.com"),
    ).toContain("user@example.com")
    expect(
      window.localStorage.getItem("cortex.idp.import.notificationExportTemplate:user@example.com"),
    ).toBe("sad_xml")
  })

  it("defaults notification settings from last recipient and export template", async () => {
    window.localStorage.setItem(
      "cortex.idp.export.emailRecipients:user@example.com",
      JSON.stringify(["last@example.com"]),
    )
    window.localStorage.setItem(
      "cortex.idp.import.notificationExportTemplate:user@example.com",
      "standard_json",
    )

    render(<ImportQueue />)

    fireEvent.click(screen.getByRole("checkbox", { name: "Wyślij wynik mailem po przetworzeniu" }))

    await waitFor(() => {
      expect(screen.getByDisplayValue("last@example.com")).not.toBeNull()
      expect(screen.getByText("Standard JSON")).not.toBeNull()
    })

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["zip"], "package.zip", { type: "application/zip" })],
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Importuj" }))

    await waitFor(() => expect(mocks.importPackage).toHaveBeenCalledTimes(1))
    expect(mocks.importPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_email: "last@example.com",
        notification_export_template: "standard_json",
      }),
    )
  })
})
