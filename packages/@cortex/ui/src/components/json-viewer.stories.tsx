import type { Story } from "@ladle/react"
import { JsonViewer } from "./json-viewer"

export default {
  title: "Domain / JsonViewer",
}

const PACKAGE_PAYLOAD = {
  package_id: "PKG-2026-0412",
  supplier: {
    name: "Acme GmbH",
    vat: "DE123456789",
    country: "DE",
  },
  invoice: {
    number: "INV-991/2026",
    issued_at: "2026-04-15",
    currency: "EUR",
    total: 18432.5,
    lines: [
      { sku: "A-0001", qty: 10, unit_price: 99.0 },
      { sku: "A-0002", qty: 42, unit_price: 412.5 },
    ],
  },
  flags: {
    verified: false,
    has_sad: true,
    needs_review: true,
  },
  notes: null,
}

export const PackagePayload: Story = () => (
  <div className="max-w-2xl p-6">
    <JsonViewer data={PACKAGE_PAYLOAD} />
  </div>
)

export const Collapsed: Story = () => (
  <div className="max-w-2xl p-6">
    <JsonViewer data={PACKAGE_PAYLOAD} initialDepth={0} />
  </div>
)

export const FullyExpanded: Story = () => (
  <div className="max-w-2xl p-6">
    <JsonViewer data={PACKAGE_PAYLOAD} initialDepth={10} />
  </div>
)

export const PrimitivesAndEmpty: Story = () => (
  <div className="grid max-w-2xl grid-cols-1 gap-4 p-6">
    <JsonViewer data={{}} />
    <JsonViewer data={[]} />
    <JsonViewer data={null} />
    <JsonViewer data={{ key: "value", count: 42, active: true, nothing: null }} />
  </div>
)
