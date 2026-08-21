"use client"

import { countryCodeSchema, mapTrimToNull } from "@/lib/form-helpers"
import type { TransportOrder, UpdateTransportInfoRequest } from "@cortex/types"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"

const schema = z.object({
  transport_order_number: z.string().max(64),
  mode: z.string().max(32),
  truck_plate: z.string().max(32),
  trailer_plate: z.string().max(32),
  country_of_dispatch: countryCodeSchema,
  country_of_destination: countryCodeSchema,
})

type FormValues = z.infer<typeof schema>

const FIELDS: readonly FieldSpec<FormValues>[] = [
  { name: "transport_order_number", labelKey: "transportOrders.fields.toNumber", span: 2 },
  { name: "mode", labelKey: "transportOrders.fields.mode", span: 1 },
  { name: "truck_plate", labelKey: "transportOrders.fields.truckPlate", span: 1 },
  { name: "trailer_plate", labelKey: "transportOrders.fields.trailerPlate", span: 1 },
  {
    name: "country_of_dispatch",
    labelKey: "transportOrders.fields.from",
    span: 1,
    uppercase: true,
  },
  {
    name: "country_of_destination",
    labelKey: "transportOrders.fields.to",
    span: 1,
    uppercase: true,
  },
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

interface Props {
  order: TransportOrder
  canEdit: boolean
  isSaving?: boolean | undefined
  onSave: (body: UpdateTransportInfoRequest) => Promise<void>
}

export function TransportInfoEditor({ order, canEdit, isSaving, onSave }: Props) {
  const { t } = useTranslation("idp")
  return (
    <FieldsForm
      label={t("transportOrders.sections.transportInfo")}
      fields={FIELDS}
      defaults={toDefaults(order)}
      schema={schema}
      canEdit={canEdit}
      isSaving={isSaving}
      resetKey={order.id}
      onSave={(v) => onSave(mapTrimToNull(v))}
    />
  )
}
