"use client"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import { Check, Inbox, ShieldCheck, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { when } from "../lib"
import { api } from "../routes"
import { Icon } from "./icon"
import { Loading } from "./loading"
import { useToast } from "./toast"

type Request = {
  id: number
  who: string
  whoName: string
  capability: string
  name: string
  department: string
  status: string
  at: string
  justification: string | null
}

export function RequestSupervision() {
  const [requests, setRequests] = useState<Request[] | null>(null)
  const [taken, setTaken] = useState<number | null>(null)
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    const r = await fetch(api("/request"), { cache: "no-store" })
    const d = await r.json()
    setRequests(d.requests ?? [])
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  async function revoke(p: Request) {
    setTaken(p.id)
    const r = await fetch(api("/request"), {
      method: "PATCH",
      body: JSON.stringify({ id: p.id, revoke: true }),
    })
    setTaken(null)
    await refresh()
    toast(
      r.ok
        ? { text: translate("requests.revoked", { name: p.name, who: p.whoName }) }
        : { text: translate("requests.revokeFailed"), tone: "error" },
    )
  }

  async function decide(p: Request, decision: "granted" | "denied") {
    setTaken(p.id)
    const r = await fetch(api("/request"), {
      method: "PATCH",
      body: JSON.stringify({ id: p.id, decision }),
    })
    setTaken(null)
    await refresh()
    if (!r.ok) {
      toast({ text: translate("requests.decisionFailed"), tone: "error" })
      return
    }
    toast({
      text:
        decision === "granted"
          ? translate("requests.granted", { who: p.whoName, name: p.name })
          : translate("requests.denied", { who: p.whoName }),
    })
  }

  const pending = (requests ?? []).filter((p) => p.status === "pending")
  const decided = (requests ?? []).filter((p) => p.status !== "pending")

  return (
    <div className="space-y-6">
      <section>
        <h2 className="t-section mb-2">{translate("requests.waiting")}</h2>
        {requests === null ? (
          // NAJDROŻSZE KŁAMSTWO W CAŁYM PRODUKCIE stało akurat tutaj: „nic nie czeka"
          // pokazane przełożonemu, zanim wiadomo, czy coś czeka. Kolejka decyzji jest
          // jedyną rzeczą na tym ekranie, która wymaga CZŁOWIEKA — jej fałszywe „pusto"
          // kończy się tym, że ktoś czeka na zgodę, o której nikt się nie dowiedział.
          <Loading rows={3} />
        ) : pending.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Icon as={Inbox} px={20} className="mx-auto text-desk-muted-2" />
            <p className="t-meta mt-1.5">{translate("requests.nothing")}</p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  {p.capability === "other" ? (
                    <>
                      <span className="t-body block">
                        {translate("requests.asksOutside", { who: p.whoName })}
                      </span>
                      <span className="t-body mt-0.5 block rounded-md bg-desk-raised/60 px-2.5 py-1.5">
                        {p.justification}
                      </span>
                      <span className="t-meta mt-1 block">
                        {when(p.at, locale)} · {translate("requests.notClickable")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="t-body block">
                        {translate("requests.asksFor", { who: p.whoName, name: p.name })}
                      </span>
                      <span className="t-meta block">
                        {when(p.at, locale)} ·{" "}
                        {translate("requests.approvedBy", {
                          department: departmentLabel(translate, p.department),
                        })}
                      </span>
                    </>
                  )}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    onClick={() => decide(p, "denied")}
                    disabled={taken === p.id}
                    className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised disabled:opacity-50"
                  >
                    <Icon as={X} px={14} />{" "}
                    {p.capability === "other"
                      ? translate("common.close")
                      : translate("requests.deny")}
                  </button>
                  {p.capability !== "other" && (
                    <button
                      onClick={() => decide(p, "granted")}
                      disabled={taken === p.id}
                      className="t-btn flex h-8 items-center gap-1.5 rounded-md bg-desk-accent px-2.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-50"
                    >
                      <Icon as={Check} px={14} /> {translate("requests.grant")}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="t-section mb-2">{translate("requests.decided")}</h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
            {decided.slice(0, 10).map((p) => (
              <li key={p.id} className="t-body flex items-center gap-3 px-4 py-2.5">
                <Icon
                  as={p.status === "granted" ? ShieldCheck : X}
                  px={16}
                  className={
                    p.status === "granted" ? "shrink-0 text-desk-ok" : "shrink-0 text-desk-muted"
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  {p.whoName} · {p.name}
                </span>
                <span className="t-meta shrink-0">
                  {p.status === "granted"
                    ? translate("requests.stateGranted")
                    : translate("requests.stateDenied")}
                </span>
                {p.status === "granted" && (
                  <button
                    onClick={() => revoke(p)}
                    disabled={taken === p.id}
                    className="shrink-0 rounded-sm border px-2 py-0.5 text-[12px] hover:bg-desk-raised disabled:opacity-50"
                  >
                    {translate("requests.revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
