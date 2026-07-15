// @vitest-environment jsdom
import type { PackageActionReadModel, PackageActionType } from "@cortex/types"
import { PACKAGE_ACTION_TYPE } from "@cortex/types"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ActionLogTimeline, categorise, normaliseEditPayload } from "../action-log-timeline"

const T0 = Date.parse("2026-04-20T10:30:00Z")
const mins = (n: number) => new Date(T0 - n * 60_000).toISOString()

function event(
  id: string,
  action_type: PackageActionType,
  overrides: Partial<PackageActionReadModel> = {},
): PackageActionReadModel {
  return {
    id,
    action_type,
    timestamp: mins(10),
    performed_by: "anna.k@cortex",
    payload: null,
    ...overrides,
  }
}

const FIXTURE: PackageActionReadModel[] = [
  event("1", "imported", { timestamp: mins(90), performed_by: "system" }),
  event("2", "analysing", { timestamp: mins(85), performed_by: "system" }),
  event("3", "ready_for_verification", { timestamp: mins(60), performed_by: "system" }),
  event("4", "seller_updated", {
    timestamp: mins(35),
    performed_by: "anna.k@cortex",
    payload: JSON.stringify({ field: "vat", previous: "DE0", next: "DE9" }),
  }),
  event("5", "invoice_line_updated", {
    timestamp: mins(20),
    performed_by: "anna.k@cortex",
    payload: JSON.stringify({ line_no: 2, changes: { qty: { prev: 40, next: 42 } } }),
  }),
  event("6", "verification", { timestamp: mins(10), performed_by: "anna.k@cortex" }),
  event("7", "verified", { timestamp: mins(2), performed_by: "anna.k@cortex" }),
]

describe("normaliseEditPayload", () => {
  it("returns [] for null", () => {
    expect(normaliseEditPayload(null)).toEqual([])
  })

  it("returns [] for non-object string", () => {
    expect(normaliseEditPayload("not-an-object")).toEqual([])
  })

  it("recognises flat shape with field/previous/next", () => {
    const result = normaliseEditPayload({
      field: "vat",
      previous: "old",
      next: "new",
    })
    expect(result).toEqual([{ field: "vat", from: "old", to: "new" }])
  })

  it("recognises nested shape with line_no — prefixes field name", () => {
    const result = normaliseEditPayload({
      line_no: 2,
      changes: { qty: { prev: 40, next: 42 } },
    })
    expect(result).toEqual([{ field: "line 2 qty", from: 40, to: 42 }])
  })

  it("emits one row per change in nested shape", () => {
    const result = normaliseEditPayload({
      line_no: 5,
      changes: {
        qty: { prev: 1, next: 2 },
        unit_price: { previous: 10, next: 11 },
      },
    })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.field).sort()).toEqual(["line 5 qty", "line 5 unit_price"])
  })

  it("recognises nested shape without line_no — bare field names", () => {
    const result = normaliseEditPayload({
      changes: { email: { previous: "a", next: "b" } },
    })
    expect(result).toEqual([{ field: "email", from: "a", to: "b" }])
  })

  it("recognises diff shape with from/to", () => {
    const result = normaliseEditPayload({
      net: { from: 100, to: 105 },
      vat: { from: 23, to: 24 },
    })
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.field === "net")).toEqual({
      field: "net",
      from: 100,
      to: 105,
    })
  })

  it("returns [] for unknown shape", () => {
    expect(normaliseEditPayload({ random: { stuff: "nope" }, another: 42 })).toEqual([])
  })
})

describe("categorise", () => {
  it("categorises every *_updated action as edit", () => {
    const updated: PackageActionType[] = PACKAGE_ACTION_TYPE.filter((t) => t.endsWith("_updated"))
    for (const t of updated) {
      expect(categorise(t)).toBe("edit")
    }
  })

  it("categorises verification actions as verification", () => {
    expect(categorise("verification")).toBe("verification")
    expect(categorise("cancel_verification")).toBe("verification")
    expect(categorise("unlock_verification")).toBe("verification")
    expect(categorise("verified")).toBe("verification")
    expect(categorise("reset_verification")).toBe("verification")
  })

  it("categorises lifecycle actions as system", () => {
    expect(categorise("imported")).toBe("system")
    expect(categorise("imported_with_error")).toBe("system")
    expect(categorise("analysing")).toBe("system")
    expect(categorise("analysis_failed")).toBe("system")
    expect(categorise("ready_for_verification")).toBe("system")
    expect(categorise("deleted")).toBe("system")
    expect(categorise("restored")).toBe("system")
  })

  it("returns a defined category for every PACKAGE_ACTION_TYPE value", () => {
    for (const t of PACKAGE_ACTION_TYPE) {
      const c = categorise(t)
      expect(["edit", "system", "verification"]).toContain(c)
    }
  })
})

describe("<ActionLogTimeline>", () => {
  it("renders empty-state copy when events is []", () => {
    render(<ActionLogTimeline events={[]} />)
    expect(screen.getByText("No actions yet.")).toBeTruthy()
  })

  it("renders toolbar with filter chips and counts", () => {
    render(<ActionLogTimeline events={FIXTURE} />)
    const all = screen.getByRole("button", { name: /^All/ })
    expect(within(all).getByText("7")).toBeTruthy()
    const userEdits = screen.getByRole("button", { name: /^User edits/ })
    expect(within(userEdits).getByText("2")).toBeTruthy()
    const system = screen.getByRole("button", { name: /^System/ })
    expect(within(system).getByText("3")).toBeTruthy()
    const verification = screen.getByRole("button", { name: /^Verification/ })
    expect(within(verification).getByText("2")).toBeTruthy()
  })

  it("opens the newest event by default on first render", () => {
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    expect(rows.length).toBe(7)
    expect(rows[0]!.open).toBe(true)
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.open).toBe(false)
    }
  })

  it("toggling a row updates its open state", async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    const second = rows[1]!
    expect(second.open).toBe(false)
    await user.click(second.querySelector("summary")!)
    expect(second.open).toBe(true)
  })

  it("collapse all closes every row", async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    await user.click(screen.getByRole("button", { name: "Collapse all" }))
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    for (const row of rows) {
      expect(row.open).toBe(false)
    }
  })

  it("expand all opens every row", async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    await user.click(screen.getByRole("button", { name: "Expand all" }))
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    for (const row of rows) {
      expect(row.open).toBe(true)
    }
  })

  it("'User edits' filter hides system and verification rows", async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    await user.click(screen.getByRole("button", { name: /^User edits/ }))
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    expect(rows.length).toBe(2)
  })

  it("filter chip applies aria-pressed to the active option", async () => {
    const user = userEvent.setup()
    render(<ActionLogTimeline events={FIXTURE} />)
    const all = screen.getByRole("button", { name: /^All/ })
    expect(all.getAttribute("aria-pressed")).toBe("true")
    const system = screen.getByRole("button", { name: /^System/ })
    expect(system.getAttribute("aria-pressed")).toBe("false")
    await user.click(system)
    expect(system.getAttribute("aria-pressed")).toBe("true")
    expect(all.getAttribute("aria-pressed")).toBe("false")
  })

  it("renders inline diff preview with → arrow for flat-shape edit events", () => {
    render(
      <ActionLogTimeline
        events={[
          event("e1", "seller_updated", {
            payload: JSON.stringify({
              field: "vat",
              previous: "DE000",
              next: "DE999",
            }),
          }),
        ]}
      />,
    )
    // The diff appears both in the inline summary preview and in the expanded body
    // diff table — assert at least one match exists for each value.
    expect(screen.getAllByText(/DE000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/DE999/).length).toBeGreaterThan(0)
    expect(screen.getByText("→")).toBeTruthy()
  })

  it("reprocess events render Reprocess badges in body — not the diff table", () => {
    render(
      <ActionLogTimeline
        events={[
          event("r1", "analysing", {
            payload: JSON.stringify({
              reprocess: true,
              use_fast_model: true,
              additional_ai_context_enabled: false,
              packaging_selection_mode: "force_pallets",
            }),
          }),
        ]}
      />,
    )
    expect(screen.getByText("No additional context")).toBeTruthy()
    expect(screen.getByText("Fast processing")).toBeTruthy()
    expect(screen.getByText("Packaging: pallets")).toBeTruthy()
    expect(screen.queryByText("Field")).toBeNull()
  })

  it("falls back to JsonViewer for unrecognised payload shapes", () => {
    const { container } = render(
      <ActionLogTimeline
        events={[
          event("u1", "user_notes_updated", {
            payload: JSON.stringify({ arbitrary: "value", another: 42 }),
          }),
        ]}
      />,
    )
    // JsonViewer renders inside a font-mono div with bg-muted/30 wrapper.
    const fontMonoWrapper = container.querySelector(".font-mono.text-xs")
    expect(fontMonoWrapper).not.toBeNull()
  })

  it("preserves first-render newest-open default after switching filters (until user toggles)", async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionLogTimeline events={FIXTURE} />)
    // Switch to "User edits" filter — hasUserToggledRef stays false because
    // changing filter is not a user toggle.
    await user.click(screen.getByRole("button", { name: /^User edits/ }))
    const rows = container.querySelectorAll<HTMLDetailsElement>("details")
    expect(rows.length).toBe(2)
    expect(rows[0]!.open).toBe(true)
    expect(rows[1]!.open).toBe(false)
  })
})
