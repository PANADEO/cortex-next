import type { Story } from "@ladle/react"
import type { PackageActionReadModel } from "@cortex/types"
import { ActionLogTimeline } from "./action-log-timeline"

export default {
  title: "Domain / ActionLogTimeline",
}

const now = Date.parse("2026-04-20T10:30:00Z")
const mins = (n: number) => new Date(now - n * 60_000).toISOString()

const EVENTS: PackageActionReadModel[] = [
  {
    id: "1",
    action_type: "imported",
    timestamp: mins(90),
    performed_by: "importer@cortex",
    payload: null,
  },
  {
    id: "2",
    action_type: "analysing",
    timestamp: mins(85),
    performed_by: "system",
    payload: null,
  },
  {
    id: "3",
    action_type: "ready_for_verification",
    timestamp: mins(60),
    performed_by: "system",
    payload: null,
  },
  {
    id: "4",
    action_type: "seller_updated",
    timestamp: mins(35),
    performed_by: "anna.k@cortex",
    payload: JSON.stringify({
      field: "vat",
      previous: "DE000000000",
      next: "DE123456789",
    }),
  },
  {
    id: "5",
    action_type: "invoice_line_updated",
    timestamp: mins(20),
    performed_by: "anna.k@cortex",
    payload: JSON.stringify({
      line_no: 2,
      changes: { qty: { prev: 40, next: 42 } },
    }),
  },
  {
    id: "6",
    action_type: "verification",
    timestamp: mins(10),
    performed_by: "anna.k@cortex",
    payload: null,
  },
  {
    id: "7",
    action_type: "verified",
    timestamp: mins(2),
    performed_by: "anna.k@cortex",
    payload: null,
  },
]

export const FullLifecycle: Story = () => (
  <div className="max-w-xl p-6">
    <ActionLogTimeline events={EVENTS} />
  </div>
)

export const WithoutPayloads: Story = () => (
  <div className="max-w-xl p-6">
    <ActionLogTimeline events={EVENTS} showPayloads={false} />
  </div>
)

export const Empty: Story = () => (
  <div className="max-w-xl p-6">
    <ActionLogTimeline events={[]} />
  </div>
)

export const FailurePath: Story = () => (
  <div className="max-w-xl p-6">
    <ActionLogTimeline
      events={[
        {
          id: "1",
          action_type: "imported",
          timestamp: mins(30),
          performed_by: "importer@cortex",
          payload: null,
        },
        {
          id: "2",
          action_type: "analysing",
          timestamp: mins(28),
          performed_by: "system",
          payload: null,
        },
        {
          id: "3",
          action_type: "analysis_failed",
          timestamp: mins(15),
          performed_by: "system",
          payload: JSON.stringify({ error: "OCR timeout", retry_count: 3 }),
        },
      ]}
    />
  </div>
)
