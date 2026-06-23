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
})
