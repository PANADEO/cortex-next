"use client"
import { capabilityLabel, departmentLabel } from "@cortex/desk-core/capability-text"
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
  /** Nazwa zapisana w STARYM zdarzeniu; nowe niosą samo `capabilityId`. */
  name?: string | undefined
  /** Dział-właściciel: dziś wartość (`finance`), w starych zdarzeniach polski napis. */
  department?: string | undefined
  capabilityId?: string | undefined
  alreadyRequested?: boolean | undefined
}) {
  // Nazwa i dział powstają TU, przy renderze, w języku tej osoby — zdarzenie niesie
  // tożsamość. Napis ze starego zdarzenia zostaje jako zapasowy, bo tamtych spraw
  // nie przepisujemy.
  const translate = useDeskT()
  const label = capabilityLabel(translate, capabilityId, name ?? "")
  const owner = departmentLabel(translate, department)
  const [sent, setSent] = useState(Boolean(alreadyRequested))
  const [taken, setTaken] = useState(false)
  const { toast } = useToast()

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
    toast({ text: translate("lock.requestSent", { name: label, department: owner }) })
  }

  return (
    <div className="flex max-w-desk-measure gap-2.5 rounded-lg border bg-desk-surface px-3.5 py-3">
      <Icon as={Lock} px={16} className="mt-0.5 shrink-0 text-desk-muted" />
      <div className="min-w-0">
        <div className="t-body">
          {label ? translate("lock.needs", { name: label }) : translate("lock.notAllowed")}
        </div>
        <div className="t-meta mt-0.5">
          {translate("lock.about", { description })}
          {owner ? ` · ${translate("requests.approvedBy", { department: owner })}` : ""}
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
