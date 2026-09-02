"use client"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { MessageSquare, Send, Share2, X } from "lucide-react"
import { useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { when } from "../lib"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * ROZMOWA PRZY SPRAWIE — ludzie do ludzi, wyraźnie OBOK rozmowy z agentem.
 *
 * Wiadomość człowieka nie jest zdarzeniem sprawy i nie idzie do modelu. Gdyby szła,
 * uwaga rzucona koleżance na boku stałaby się poleceniem dla agenta — a nikt tego nie
 * zamawiał. Dlatego wiadomości mają własną tabelę, własną trasę i własne miejsce
 * na ekranie: pod przebiegiem, nie w nim.
 */

export type CaseMessage = { id: number; who: string; text: string; at: string }
export type CaseShare = { who: string; at: string }

export function CaseTalk({
  id,
  messages,
  shares,
  people,
  everyone,
  me,
  canShare,
  refresh,
}: {
  id: string
  messages: CaseMessage[]
  shares: CaseShare[]
  /** identyfikator → „Imię Nazwisko"; wiadomości niosą identyfikator, nie napis */
  people: Record<string, string>
  /** kogo da się dopisać do sprawy — puste, gdy nie jesteś właścicielem */
  everyone: { id: string; name: string }[]
  me: string
  canShare: boolean
  refresh: () => void
}) {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()
  const [text, setText] = useState("")
  const [taken, setTaken] = useState(false)
  const [opening, setOpening] = useState(false)

  async function act(body: Record<string, unknown>) {
    setTaken(true)
    const r = await fetch(api(`/case/${id}/talk`), { method: "POST", body: JSON.stringify(body) })
    setTaken(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast({ text: d.error || translate("talk.failed"), tone: "error" })
      return false
    }
    refresh()
    return true
  }

  const name = (who: string) => people[who] ?? who
  const canInvite = everyone.filter((u) => u.id !== me && !shares.some((s) => s.who === u.id))

  return (
    <div className="mx-auto max-w-desk-stream">
      {(shares.length > 0 || canShare) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Icon as={Share2} px={14} className="text-desk-muted" />
          <span className="t-micro">{translate("talk.seenBy")}</span>
          {shares.map((s) => (
            <span
              key={s.who}
              className="t-micro flex items-center gap-1 rounded-desk-pill border px-2 py-0.5"
            >
              {name(s.who)}
              {canShare && (
                <button
                  onClick={() => act({ action: "unshare", who: s.who })}
                  disabled={taken}
                  aria-label={translate("talk.stopSharing", { name: name(s.who) })}
                  className="text-desk-muted hover:text-desk-bad"
                >
                  <Icon as={X} px={12} />
                </button>
              )}
            </span>
          ))}
          {shares.length === 0 && <span className="t-micro">{translate("talk.nobody")}</span>}
          {/* Menu zamiast systemowego `<select>`. Surowa kontrolka systemu otwierała się
              cudzym stylem, nachodziła na napis obok i wyglądała jak wstawka z innej
              aplikacji — w miejscu, w którym człowiek podejmuje decyzję o cudzym
              dostępie do swojej pracy. Reszta Biurka używa tego samego menu. */}
          {canShare && canInvite.length > 0 && (
            <Menu.Root open={opening} onOpenChange={setOpening}>
              <Menu.Trigger className="t-micro rounded-desk-pill border px-2 py-0.5 text-desk-muted hover:bg-desk-raised hover:text-desk-ink">
                {translate("talk.share")}
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content
                  align="start"
                  sideOffset={4}
                  className="z-50 min-w-[200px] rounded-md border bg-desk-surface py-1 shadow-desk-pop"
                >
                  <Menu.Label className="t-micro px-3 py-1">
                    {translate("talk.shareWith")}
                  </Menu.Label>
                  {canInvite.map((u) => (
                    <Menu.Item
                      key={u.id}
                      onSelect={() => act({ action: "share", who: u.id })}
                      className="t-body flex cursor-pointer items-center px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
                    >
                      {u.name}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2">
              <Icon as={MessageSquare} px={14} className="mt-1 shrink-0 text-desk-muted-2" />
              <div className="min-w-0">
                <p className="t-body">
                  <span className="font-medium">{name(m.who)}</span> {m.text}
                </p>
                <p className="t-micro">{when(m.at, locale)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key !== "Enter" || !text.trim()) return
            e.preventDefault()
            if (await act({ action: "say", text })) setText("")
          }}
          maxLength={1000}
          aria-label={translate("talk.write")}
          placeholder={translate("talk.placeholder")}
          className="t-body h-9 min-w-0 flex-1 rounded-md border bg-desk-surface px-3"
        />
        <button
          onClick={async () => {
            if (!text.trim()) return
            if (await act({ action: "say", text })) setText("")
          }}
          disabled={taken || !text.trim()}
          aria-label={translate("talk.send")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border hover:bg-desk-raised disabled:opacity-40"
        >
          <Icon as={Send} px={16} />
        </button>
      </div>
      <p className="t-micro mt-1.5">{translate("talk.note")}</p>
    </div>
  )
}
