import type { PackageActionReadModel } from "@cortex/types"
import type { Story } from "@ladle/react"
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
  <div className="max-w-3xl p-6">
    <ActionLogTimeline events={EVENTS} />
  </div>
)

export const WithoutPayloads: Story = () => (
  <div className="max-w-3xl p-6">
    <ActionLogTimeline events={EVENTS} showPayloads={false} />
  </div>
)

export const Empty: Story = () => (
  <div className="max-w-3xl p-6">
    <ActionLogTimeline events={[]} />
  </div>
)

export const ReprocessVariants: Story = () => (
  <div className="max-w-3xl space-y-6 p-6">
    <ActionLogTimeline
      events={[
        {
          id: "r1",
          action_type: "analysing",
          timestamp: mins(40),
          performed_by: "anna.k@cortex",
          payload: JSON.stringify({
            reprocess: true,
            use_fast_model: false,
            additional_ai_context_enabled: true,
            additional_ai_context:
              "Faktura zawiera dwie pozycje SAD — należy zwrócić uwagę na kod CN 8517.62.00 oraz proszę użyć stawki preferencyjnej dla pozycji 2.",
          }),
        },
        {
          id: "r2",
          action_type: "analysing",
          timestamp: mins(30),
          performed_by: "anna.k@cortex",
          payload: JSON.stringify({
            reprocess: true,
            use_fast_model: true,
            additional_ai_context_enabled: false,
            additional_ai_context: null,
          }),
        },
        {
          id: "r3",
          action_type: "analysing",
          timestamp: mins(20),
          performed_by: "anna.k@cortex",
          payload: JSON.stringify({
            reprocess: true,
            use_fast_model: true,
            additional_ai_context_enabled: true,
            additional_ai_context:
              "Bardzo długi kontekst który powinien zostać obcięty z opcją 'Show more'. ".repeat(
                10,
              ),
          }),
        },
        {
          id: "r4",
          action_type: "analysing",
          timestamp: mins(10),
          performed_by: "system",
          payload: JSON.stringify({
            reprocess: false,
            use_fast_model: false,
          }),
        },
      ]}
    />
  </div>
)

export const FailurePath: Story = () => (
  <div className="max-w-3xl p-6">
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

export const EditHeavy: Story = () => (
  <div className="max-w-3xl p-6">
    <ActionLogTimeline
      events={[
        {
          id: "e1",
          action_type: "seller_updated",
          timestamp: mins(60),
          performed_by: "anna.k@cortex",
          // Shape (a): flat
          payload: JSON.stringify({
            field: "vat",
            previous: "DE000000000",
            next: "DE123456789",
          }),
        },
        {
          id: "e2",
          action_type: "invoice_line_updated",
          timestamp: mins(50),
          performed_by: "anna.k@cortex",
          // Shape (b): nested with line_no
          payload: JSON.stringify({
            line_no: 2,
            changes: {
              qty: { prev: 40, next: 42 },
              unit_price: { prev: 25.0, next: 25.5 },
            },
          }),
        },
        {
          id: "e3",
          action_type: "invoice_totals_updated",
          timestamp: mins(45),
          performed_by: "anna.k@cortex",
          // Shape (c): diff
          payload: JSON.stringify({
            net_total: { from: 1000.0, to: 1050.0 },
            vat_total: { from: 240.0, to: 252.0 },
            gross_total: { from: 1240.0, to: 1302.0 },
          }),
        },
        {
          id: "e4",
          action_type: "buyer_updated",
          timestamp: mins(35),
          performed_by: "anna.k@cortex",
          // Shape (b): nested without line_no
          payload: JSON.stringify({
            changes: {
              email: { previous: "old@buyer.com", next: "buyer@new.com" },
              phone: { prev: null, next: "+48 600 123 456" },
            },
          }),
        },
        {
          id: "e5",
          action_type: "user_notes_updated",
          timestamp: mins(20),
          performed_by: "anna.k@cortex",
          // Malformed payload — non-recognised shape, should fall back to JsonViewer
          payload: JSON.stringify({
            arbitrary: { nested: { thing: "without-diff-shape" } },
            another: "string",
          }),
        },
        {
          id: "e6",
          action_type: "delivery_terms_updated",
          timestamp: mins(10),
          performed_by: "anna.k@cortex",
          payload: JSON.stringify({
            field: "incoterm",
            previous: "DAP",
            next: "DDP",
          }),
        },
      ]}
    />
  </div>
)

export const FilteredAndSorted: Story = () => (
  <div className="max-w-3xl p-6">
    <ActionLogTimeline events={EVENTS} />
  </div>
)
