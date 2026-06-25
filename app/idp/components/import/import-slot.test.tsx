/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { emptyImportOptions } from "@/components/import-options-fields"

import { ImportSlot, type ImportSlotValue } from "./import-slot"

function makeSlot(overrides: Partial<ImportSlotValue> = {}): ImportSlotValue {
  return {
    id: "slot-test",
    files: [],
    packageName: "",
    notificationEmailEnabled: false,
    notificationEmail: "user@example.com",
    notificationExportTemplate: "sad_xml",
    options: { ...emptyImportOptions },
    status: "pending",
    ...overrides,
  }
}

describe("ImportSlot", () => {
  it("shows package name before files are selected", () => {
    const onPackageNameChange = vi.fn()

    render(
      <ImportSlot
        slot={makeSlot()}
        canRemove={false}
        onFilesChange={() => undefined}
        onPackageNameChange={onPackageNameChange}
        onNotificationEmailEnabledChange={() => undefined}
        onNotificationEmailChange={() => undefined}
        onNotificationExportTemplateChange={() => undefined}
        onOptionsChange={() => undefined}
        onRemove={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    const input = screen.getByLabelText("Package name")
    expect(input).not.toBeNull()

    fireEvent.change(input, { target: { value: "MAN Customs Batch" } })

    expect(onPackageNameChange).toHaveBeenCalledWith("MAN Customs Batch")
  })

  it("shows notification email input when email result is enabled", () => {
    const onNotificationEmailEnabledChange = vi.fn()
    const onNotificationEmailChange = vi.fn()
    const { rerender } = render(
      <ImportSlot
        slot={makeSlot()}
        canRemove={false}
        onFilesChange={() => undefined}
        onPackageNameChange={() => undefined}
        onNotificationEmailEnabledChange={onNotificationEmailEnabledChange}
        onNotificationEmailChange={onNotificationEmailChange}
        onNotificationExportTemplateChange={() => undefined}
        onOptionsChange={() => undefined}
        onRemove={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole("checkbox", { name: "Email result after processing" }))
    expect(onNotificationEmailEnabledChange).toHaveBeenCalledWith(true)

    rerender(
      <ImportSlot
        slot={makeSlot({ notificationEmailEnabled: true })}
        canRemove={false}
        onFilesChange={() => undefined}
        onPackageNameChange={() => undefined}
        onNotificationEmailEnabledChange={onNotificationEmailEnabledChange}
        onNotificationEmailChange={onNotificationEmailChange}
        onNotificationExportTemplateChange={() => undefined}
        onOptionsChange={() => undefined}
        onRemove={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    const input = screen.getByDisplayValue("user@example.com")
    fireEvent.change(input, { target: { value: "ops@example.com" } })

    expect(onNotificationEmailChange).toHaveBeenCalledWith("ops@example.com")
  })

  it("hides notification email controls when the feature is disabled", () => {
    render(
      <ImportSlot
        slot={makeSlot({ notificationEmailEnabled: true })}
        canRemove={false}
        onFilesChange={() => undefined}
        onPackageNameChange={() => undefined}
        onNotificationEmailEnabledChange={() => undefined}
        onNotificationEmailChange={() => undefined}
        onNotificationExportTemplateChange={() => undefined}
        onOptionsChange={() => undefined}
        onRemove={() => undefined}
        onSubmit={() => undefined}
        showImportEmailNotifications={false}
      />,
    )

    expect(screen.queryByRole("checkbox", { name: "Email result after processing" })).toBeNull()
    expect(screen.queryByDisplayValue("user@example.com")).toBeNull()
  })
})
