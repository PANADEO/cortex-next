"use client"
import { capabilityLabel, departmentLabel as label } from "@cortex/desk-core/capability-text"
import type { Capability } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown, Clock, Lock, Minus, Pencil, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { zl } from "../lib"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * ZESPÓŁ — ekran, na którym governance przestaje być jednostronne.
 *
 * Do tej pory przełożony widział wyłącznie PROŚBY: to, o co ktoś sam się upomniał.
 * Nie widział ani swoich ludzi, ani tego, co każdy z nich może — a odebrać dało się
 * tylko to, o co ktoś wcześniej poprosił, bo odebranie szło przez wiersz prośby.
 * Zdolności, o którą nikt nie prosił, nie dało się odebrać w ogóle.
 *
 * Pytanie „a da się to cofnąć?" pada na każdej rozmowie o AI w firmie, zaraz po
 * „a skąd wiem, co on zrobił?". Na drugie Biurko odpowiada dowodem ze zdarzeń.
 * Ten ekran jest odpowiedzią na pierwsze.
 */

type Person = {
  id: string
  firstName: string
  lastName: string
  department: string
  role: string
  granted: string[]
  /** Nadane WPROST, ponad rolę — tylko te da się odebrać. */
  grantedDirectly: string[]
  blocked: string[]
  pending: string[]
  spentUsd: number
  dailyLimitUsd: number
  /** `null` znaczy: limit pochodzi z roli, nie jest własny. */
  ownLimit: number | null
  active: boolean
}

export function Team({
  catalogue,
  roles,
  departments,
  me,
}: {
  catalogue: Capability[]
  roles: string[]
  departments: string[]
  me: string
}) {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()
  const [people, setPeople] = useState<Person[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [limiting, setLimiting] = useState<string | null>(null)
  const [taken, setTaken] = useState(false)

  const refresh = useCallback(async () => {
    const r = await fetch(api("/team"), { cache: "no-store" })
    const d = await r.json()
    setPeople(d.people ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function act(body: Record<string, unknown>, done?: string): Promise<boolean> {
    setTaken(true)
    const r = await fetch(api("/team"), { method: "POST", body: JSON.stringify(body) })
    setTaken(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast({ text: d.error || translate("team.failed"), tone: "error" })
      return false
    }
    await refresh()
    if (done) toast({ text: done })
    return true
  }

  if (people.length === 0) return <p className="t-meta py-3">{translate("team.empty")}</p>

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
      {people.map((p) => {
        const name = `${p.firstName} ${p.lastName}`.trim()
        const total = p.granted.length + p.blocked.length
        const share = Math.min(100, Math.round((p.spentUsd / p.dailyLimitUsd) * 100))
        return (
          <li key={p.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`t-body-m ${p.active ? "" : "text-desk-muted line-through"}`}>
                {name || p.id}
              </span>
              {p.id === me && <span className="t-micro">{translate("team.you")}</span>}
              {!p.active && <span className="t-micro">{translate("team.disabled")}</span>}
              <Picker
                value={p.role}
                options={roles.map((r) => ({ id: r, label: translate(`team.role.${r}`) }))}
                aria={translate("team.roleLabel")}
                disabled={taken}
                choose={(role) => act({ action: "role", who: p.id, role })}
              />
              <Picker
                value={p.department}
                options={departments.map((d) => ({ id: d, label: label(translate, d) }))}
                empty={translate("team.noDepartment")}
                aria={translate("team.departmentLabel")}
                disabled={taken}
                choose={(department) => act({ action: "department", who: p.id, department })}
              />
              <span className="t-meta ml-auto flex items-center gap-1.5 tabular-nums">
                {translate("team.spent", {
                  spent: zl(p.spentUsd, locale),
                  limit: zl(p.dailyLimitUsd, locale),
                })}
                <button
                  onClick={() => setLimiting(limiting === p.id ? null : p.id)}
                  aria-label={translate("team.changeLimit", { name })}
                  className="rounded-sm px-1 text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
                >
                  <Icon as={Pencil} px={12} />
                </button>
              </span>
            </div>

            {limiting === p.id && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  defaultValue={p.ownLimit ?? p.dailyLimitUsd}
                  autoFocus
                  aria-label={translate("team.limitLabel")}
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") setLimiting(null)
                    if (e.key !== "Enter") return
                    const usd = Number((e.target as HTMLInputElement).value)
                    if (await act({ action: "limit", who: p.id, usd })) setLimiting(null)
                  }}
                  className="t-body h-8 w-28 rounded-md border bg-desk-bg px-2"
                />
                {p.ownLimit !== null && (
                  // „Wróć do roli" to inna operacja niż „ustaw zero" — zero znaczyłoby
                  // „nie wolno ci nic", a tu chodzi o powrót do tego, co ma każdy.
                  <button
                    onClick={() => act({ action: "limit", who: p.id, usd: null })}
                    className="t-micro rounded-desk-pill border px-2 py-0.5 text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
                  >
                    {translate("team.limitFromRole")}
                  </button>
                )}
                <span className="t-micro">{translate("team.limitHint")}</span>
              </div>
            )}

            <div className="mt-1.5 h-1 overflow-hidden rounded-desk-pill bg-desk-raised">
              <div
                className={`h-full rounded-desk-pill ${share >= 90 ? "bg-desk-bad" : share >= 70 ? "bg-desk-warn" : "bg-desk-ok"}`}
                style={{ width: `${Math.max(share, 2)}%` }}
              />
            </div>

            {p.id !== me && (
              <button
                onClick={() =>
                  act(
                    { action: "active", who: p.id, active: !p.active },
                    translate(p.active ? "team.disabledDone" : "team.enabledDone", {
                      name: name || p.id,
                    }),
                  )
                }
                disabled={taken}
                className="t-micro mt-1.5 rounded-desk-pill border px-2 py-0.5 text-desk-muted hover:bg-desk-raised hover:text-desk-ink disabled:opacity-50"
              >
                {translate(p.active ? "team.disable" : "team.enable")}
              </button>
            )}

            <button
              onClick={() => setOpen(open === p.id ? null : p.id)}
              aria-expanded={open === p.id}
              className="t-meta mt-2 flex items-center gap-1.5 hover:text-desk-ink"
            >
              {translate("team.can", { granted: p.granted.length, total })}
              {p.pending.length > 0 && (
                <span className="flex items-center gap-1 text-desk-warn">
                  <Icon as={Clock} px={12} /> {p.pending.length}
                </span>
              )}
              <Icon as={ChevronDown} px={12} className={open === p.id ? "rotate-180" : ""} />
            </button>

            {open === p.id && (
              <ul className="mt-2 space-y-1">
                {catalogue.map((z) => {
                  const has = p.granted.includes(z.id)
                  // Zdolność Z ROLI też jest nadana, ale nie ma jej w tabeli nadań —
                  // odbieranie jej po jednej byłoby kłamstwem, bo wróciłaby przy
                  // następnym odczycie polityki. Stąd osobny stan, a nie ukrycie.
                  const fromRole = has && !canRevoke(p, z.id)
                  return (
                    <li key={z.id} className="flex items-center gap-2">
                      <Icon
                        as={has ? Check : Lock}
                        px={14}
                        className={has ? "shrink-0 text-desk-ok" : "shrink-0 text-desk-muted-2"}
                      />
                      <span className={`t-body min-w-0 flex-1 ${has ? "" : "text-desk-muted"}`}>
                        {capabilityLabel(translate, z.id, z.id)}
                      </span>
                      {p.pending.includes(z.id) && (
                        <span className="t-micro shrink-0 text-desk-warn">
                          {translate("team.waiting")}
                        </span>
                      )}
                      {fromRole ? (
                        <span className="t-micro shrink-0" title={translate("team.byRoleNote")}>
                          {translate("team.byRole")}
                        </span>
                      ) : (
                        <button
                          disabled={taken}
                          onClick={() =>
                            act(
                              { action: has ? "revoke" : "grant", who: p.id, capability: z.id },
                              translate(has ? "team.revoked" : "team.granted", {
                                name: capabilityLabel(translate, z.id, z.id),
                                who: name || p.id,
                              }),
                            )
                          }
                          className="t-micro flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 hover:bg-desk-raised disabled:opacity-50"
                        >
                          <Icon as={has ? Minus : Plus} px={12} />
                          {translate(has ? "team.revoke" : "team.grant")}
                        </button>
                      )}
                    </li>
                  )
                })}
                <li className="t-micro pt-1">{translate("team.byRoleNote")}</li>
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Czy tę zdolność da się odebrać temu człowiekowi. Serwer podaje zestaw ZMATERIALIZOWANY
 * — rola plus nadania — więc sama obecność na liście nie mówi, skąd się wzięła.
 * Odebrać da się wyłącznie nadanie; to, co daje rola, wróciłoby przy następnym odczycie
 * polityki, a przycisk, po którym nic się nie zmienia, jest gorszy niż jego brak.
 */
function canRevoke(p: Person, capability: string): boolean {
  return p.grantedDirectly.includes(capability)
}

/**
 * Wybór jednej wartości z zamkniętej listy. Zwykły `<select>` byłby tu krótszy, ale
 * w ciemnym motywie Windows maluje go systemowo i wychodzi biała plama; to samo menu,
 * co w pozostałych miejscach Biurka, zachowuje się wszędzie tak samo.
 */
function Picker({
  value,
  options,
  empty,
  aria,
  disabled,
  choose,
}: {
  value: string
  options: { id: string; label: string }[]
  empty?: string
  aria: string
  disabled?: boolean
  choose: (id: string) => void
}) {
  const current = options.find((o) => o.id === value)
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        aria-label={aria}
        className="t-micro flex h-6 items-center gap-1 rounded-desk-pill border px-2 text-desk-muted hover:bg-desk-raised hover:text-desk-ink disabled:opacity-50"
      >
        {current?.label ?? empty ?? value}
        <Icon as={ChevronDown} px={12} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[160px] overflow-hidden rounded-md border bg-desk-surface py-1 shadow-desk-pop"
        >
          {options.map((o) => (
            <Menu.Item
              key={o.id}
              onSelect={() => choose(o.id)}
              className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
            >
              <Icon as={Check} px={14} className={o.id === value ? "" : "opacity-0"} />
              <span className="flex-1">{o.label}</span>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
