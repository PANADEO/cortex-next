"use client"
import type { Capability, Policy } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown, Lock, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useDeskT } from "../i18n/client"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * „Co potrafię" mieszka tam, gdzie jest potrzebne: przy polu zlecenia.
 * Zablokowana zdolność jest widoczna dla CZŁOWIEKA (z działem-właścicielem i prośbą o dostęp),
 * ale nigdy nie trafia do modelu — tam po prostu nie ma takiego narzędzia.
 */
const SEARCH_THRESHOLD = 14

/** Grupujemy po dziale — to jedyny wymiar, który rośnie razem z katalogiem. */
function byDepartment(zd: Capability[]) {
  const m = new Map<string, Capability[]>()
  for (const z of zd) m.set(z.department, [...(m.get(z.department) ?? []), z])
  return [...m.entries()].sort((a, b) =>
    a[0] === "wszyscy" ? -1 : b[0] === "wszyscy" ? 1 : a[0].localeCompare(b[0], "pl"),
  )
}

export function CapabilityList({
  p,
  dense,
  search,
}: {
  p: Policy
  dense?: boolean | undefined
  search?: boolean
}) {
  const translate = useDeskT()
  const [sent, setSent] = useState<string[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [phrase, setPhrase] = useState("")
  const { toast } = useToast()

  // stan prośby żyje w bazie, nie w komponencie — inaczej znika przy pierwszym F5
  useEffect(() => {
    let alive = true
    fetch(api("/request"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { requests?: { capability: string; status: string }[] }) => {
        if (!alive) return
        setSent((d.requests ?? []).filter((x) => x.status === "pending").map((x) => x.capability))
        setRejected(
          (d.requests ?? []).filter((x) => x.status === "denied").map((x) => x.capability),
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function request(id: string, name: string) {
    await fetch(api("/request"), { method: "POST", body: JSON.stringify({ capability: id }) })
    setSent((w) => [...w, id])
    toast({
      text: translate("capabilities.requestQueued", { name }),
    })
  }

  const matches = (z: Capability) =>
    !phrase.trim() ||
    `${z.name} ${z.description} ${z.department}`.toLowerCase().includes(phrase.trim().toLowerCase())

  const have = p.granted.filter(matches)
  const missing = p.blocked.filter(matches)
  const all = p.granted.length + p.blocked.length
  // grupowanie ma sens dopiero wtedy, gdy jest co grupować — przy jednym dziale
  // nagłówek „Dla wszystkich" nad całą listą byłby samym szumem
  const groupBy = new Set(have.map((z) => z.department)).size > 1

  return (
    <div className={dense ? "text-[13px]" : "text-[14px]"}>
      {search && all > SEARCH_THRESHOLD && (
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={translate("capabilities.search")}
          aria-label={translate("capabilities.search")}
          className="t-body mb-3 h-9 w-full rounded-md border bg-desk-bg px-3 outline-none placeholder:text-desk-muted-2"
        />
      )}

      {have.length > 0 &&
        (groupBy ? (
          byDepartment(have).map(([department, zd]) => (
            <div key={department} className="mb-2.5">
              <div className="t-micro px-1 pb-1">
                {department === "wszyscy" ? translate("capabilities.everyone") : department}
              </div>
              <MenuItems zd={zd} dense={dense} />
            </div>
          ))
        ) : (
          <MenuItems zd={have} dense={dense} />
        ))}

      {missing.length > 0 && (
        <>
          <div className="t-micro mt-2.5 border-t pt-2.5">{translate("capabilities.notYet")}</div>
          <ul className="mt-1 space-y-1.5">
            {missing.map((z) => (
              <li key={z.id} className="flex items-start gap-2 rounded-sm px-1 py-0.5">
                <Icon as={Lock} px={16} className="mt-0.5 shrink-0 text-desk-muted-2" />
                <div className="min-w-0 flex-1">
                  <div className="text-desk-muted">{z.name}</div>
                  <div className="t-micro">
                    {translate("capabilities.ownedBy", { department: z.department })}
                  </div>
                  {sent.includes(z.id) ? (
                    <div className="mt-1 flex items-center gap-1 text-[12px] text-desk-ok">
                      <Icon as={ShieldCheck} px={12} /> {translate("capabilities.requestSent")}
                    </div>
                  ) : (
                    <>
                      {rejected.includes(z.id) && (
                        <div className="mt-1 text-[12px] text-desk-muted">
                          {translate("capabilities.previouslyDenied")}
                        </div>
                      )}
                      <button
                        onClick={() => request(z.id, z.name)}
                        className="mt-1 rounded-sm border px-2 py-0.5 text-[12px] hover:bg-desk-raised"
                      >
                        {rejected.includes(z.id)
                          ? translate("capabilities.askAgain")
                          : translate("capabilities.ask")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {phrase.trim() && have.length === 0 && missing.length === 0 && (
        <p className="t-meta py-3">{translate("capabilities.nothingFound")}</p>
      )}
    </div>
  )
}

function MenuItems({ zd, dense }: { zd: Capability[]; dense?: boolean | undefined }) {
  return (
    <ul className="space-y-0.5">
      {zd.map((z) => (
        <li key={z.id} className="flex items-start gap-2 rounded-sm px-1 py-1">
          <Icon as={Check} px={16} className="mt-0.5 shrink-0 text-desk-ok" />
          <div className="min-w-0">
            <div>{z.name}</div>
            {!dense && <div className="t-meta">{z.description}</div>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function count(n: number, j: string, k: string, w: string) {
  const d = n % 10,
    s = n % 100
  if (n === 1) return `${n} ${j}`
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${k}`
  return `${n} ${w}`
}

/** Przy polu zlecenia — jeden klik odpowiada na pytanie „czy on to w ogóle umie?". */
export function CapabilityButton({ p }: { p: Policy }) {
  const [open, setOtwarty] = useState(false)
  const translate = useDeskT()
  return (
    <Menu.Root open={open} onOpenChange={setOtwarty}>
      <Menu.Trigger className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-desk-muted hover:bg-desk-raised hover:text-desk-ink">
        <Icon as={Check} px={14} className="text-desk-ok" />
        {translate("capabilities.canDoHere", { count: p.granted.length })}
        <Icon
          as={ChevronDown}
          px={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          // Radix sam odbija zawartość od krawędzi okna i podaje wysokość, która realnie została;
          // wcześniej własny popover po prostu wychodził poza ekran i tracił górne pozycje.
          style={{ maxHeight: "var(--radix-dropdown-menu-content-available-height)" }}
          className="z-50 w-[320px] overflow-y-auto rounded-lg border bg-desk-surface p-3 shadow-desk-pop"
        >
          <CapabilityList p={p} dense />
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
