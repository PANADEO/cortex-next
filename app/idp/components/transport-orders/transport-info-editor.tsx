"use client"

import type { TransportOrder, UpdateTransportInfoRequest } from "@cortex/types"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"

const schema = z.object({
  transport_order_number: z.string().max(64),
  mode: z.string().max(32),
  truck_plate: z.string().max(32),
  trailer_plate: z.string().max(32),
  country_of_dispatch: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
  country_of_destination: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
})

type FormValues = z.infer<typeof schema>

const FIELDS: readonly FieldSpec<FormValues>[] = [
  { name: "transport_order_number", label: "TO number", span: 2 },
  { name: "mode", label: "Mode", span: 1 },
  { name: "truck_plate", label: "Truck plate", span: 1 },
  { name: "trailer_plate", label: "Trailer plate", span: 1 },
  { name: "country_of_dispatch", label: "From", span: 1, uppercase: true },
  { name: "country_of_destination", label: "To", span: 1, uppercase: true },
]

function toDefaults(order: TransportOrder): FormValues {
  return {
    transport_order_number: order.transport_order_number ?? "",
    mode: order.mode ?? "",
    truck_plate: order.truck_plate ?? "",
    trailer_plate: order.trailer_plate ?? "",
    country_of_dispatch: order.country_of_dispatch ?? "",
    country_of_destination: order.country_of_destination ?? "",
  }
}

function toRequest(values: FormValues): UpdateTransportInfoRequest {
  const entries = Object.entries(values).map(([k, v]) => [k, v.trim() ? v.trim() : null])
  return Object.fromEntries(entries) as UpdateTransportInfoRequest
}

interface Props {
  order: TransportOrder
  canEdit: boolean
  isSaving?: boolean | undefined
  onSave: (body: UpdateTransportInfoRequest) => Promise<void>
}

export function TransportInfoEditor({ order, canEdit, isSaving, onSave }: Props) {
  return (
    <FieldsForm
      label="Transport info"
      fields={FIELDS}
      defaults={toDefaults(order)}
      schema={schema}
      canEdit={canEdit}
      isSaving={isSaving}
      onSave={(v) => onSave(toRequest(v))}
    />
  )
}
