"use client"
import { Lock, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useDeskT } from "../i18n/client"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * Moment, w którym governance przestaje być slajdem i staje się rzeczą na ekranie.
 * Kłódka jest szara, nie pomarańczowa ani czerwona — to nie awaria, tylko polityka firmy.
 */
export function CapabilityLock({
  description,
  name,
  department,
  capabilityId,
  alreadyRequested,
}: {
  description: string
  name?: string | undefined
  department?: string | undefined
  capabilityId?: string | undefined
  alreadyRequested?: boolean | undefined
}) {
  const [sent, setSent] = useState(Boolean(alreadyRequested))
  const [taken, setTaken] = useState(false)
  const { toast } = useToast()
  const translate = useDeskT()

  async function request() {
    if (!capabilityId) return
    setTaken(true)
    const r = await fetch(api("/request"), {
      method: "POST",
      body: JSON.stringify({ capability: capabilityId }),
    })
    setTaken(false)
    if (!r.ok) {
      toast({ text: translate("lock.requestFailed"), tone: "error" })
      return
    }
    setSent(true)
    toast({ text: translate("lock.requestSent", { name, department }) })
  }

  return (
    <div className="flex max-w-desk-measure gap-2.5 rounded-lg border bg-desk-surface px-3.5 py-3">
      <Icon as={Lock} px={16} className="mt-0.5 shrink-0 text-desk-muted" />
      <div className="min-w-0">
        <div className="t-body">
          {name ? translate("lock.needs", { name }) : translate("lock.notAllowed")}
        </div>
        <div className="t-meta mt-0.5">
          {translate("lock.about", { description })}
          {department ? ` · ${translate("requests.approvedBy", { department })}` : ""}
        </div>
        {capabilityId &&
          (sent ? (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-desk-ok">
              <Icon as={ShieldCheck} px={12} /> {translate("capabilities.requestSent")}
            </div>
          ) : (
            <button
              onClick={request}
              disabled={taken}
              className="t-btn mt-2 rounded-md border px-2.5 py-1 hover:bg-desk-raised disabled:opacity-50"
            >
              {translate("capabilities.ask")}
            </button>
          ))}
      </div>
    </div>
  )
}
