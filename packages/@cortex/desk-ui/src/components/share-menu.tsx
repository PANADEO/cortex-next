"use client"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { Check, Link2, Share2, UserPlus, X } from "lucide-react"
import { useState } from "react"
import { useDeskT } from "../i18n/client"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

export type CaseShare = { who: string; at: string }

/**
 * UDOSTĘPNIENIE SPRAWY — ikona przy trzech kropkach, nie pas nad polem zlecenia.
 *
 * CO TU BYŁO DO 03.09.2026. Na dole sprawy stał pas: „Widzą: tylko Ty · + Udostępnij",
 * pod nim pole „Napisz do osób, które widzą tę sprawę…" z przyciskiem wysyłki i zdanie
 * wyjaśniające, że tych wiadomości asystent nie czyta. Trzy rzeczy naraz, w miejscu,
 * w którym człowiek chce napisać ZLECENIE.
 *
 * Dwa powody, dla których to wyleciało — oba decyzją właściciela produktu:
 *
 *  1. Pas zabierał wysokość dokładnie nad polem, w które się pisze. Udostępnienie jest
 *     czynnością rzadką („raz na sprawę"), a stało tam, gdzie sięga się co minutę —
 *     ten sam błąd, przez który „Co potrafię" wyleciało wcześniej z paska bocznego.
 *  2. Wiadomości między ludźmi to DRUGI kanał rozmowy w produkcie, który ma jeden.
 *     Ktokolwiek by go użył, robiłby to obok sprawy, obok dowodu i obok wszystkiego,
 *     co ten produkt umie pokazać — a firma ma do tego pocztę i komunikator.
 *
 * ZOSTAJE SAM PODGLĄD. Osoba, której udostępniono sprawę, widzi ją i nic więcej: nie
 * zleca (pole zlecenia dostaje wyłącznie właściciel), nie zmienia, nie pisze. „Kopia
 * u siebie" wstrzymana świadomie — wróci, gdy będzie wiadomo, co ma znaczyć.
 */
export function ShareMenu({
  id,
  shares,
  people,
  everyone,
  me,
  refresh,
}: {
  id: string
  shares: CaseShare[]
  /** identyfikator → „Imię Nazwisko"; sprawa niesie identyfikator, nie napis */
  people: Record<string, string>
  /** kogo da się dopisać — puste, gdy nie jesteś właścicielem */
  everyone: { id: string; name: string }[]
  me: string
  refresh: () => void
}) {
  const translate = useDeskT()
  const { toast } = useToast()
  const [taken, setTaken] = useState(false)
  const [copied, setCopied] = useState(false)

  async function act(body: Record<string, unknown>) {
    setTaken(true)
    const r = await fetch(api(`/case/${id}/talk`), { method: "POST", body: JSON.stringify(body) })
    setTaken(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast({ text: d.error || translate("share.failed"), tone: "error" })
      return
    }
    refresh()
  }

  const name = (who: string) => people[who] ?? who
  const canInvite = everyone.filter((u) => u.id !== me && !shares.some((s) => s.who === u.id))

  /**
   * Link kopiujemy z PASKA ADRESU, a nie sklejamy ze stałej. Biurko stoi pod dwoma
   * adresami — samodzielnie i jako kafelek powłoki — więc sklejony adres byłby poprawny
   * w jednym wdrożeniu i prowadziłby donikąd w drugim.
   */
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Schowek bywa niedostępny (brak zgody, stary silnik) — mówimy o tym wprost,
      // zamiast udawać, że się udało.
      toast({ text: translate("share.copyFailed"), tone: "error" })
    }
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={translate("share.open")}
        title={translate("share.open")}
        className="relative grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
      >
        <Icon as={Share2} px={16} />
        {/* Kropka mówi, że sprawa JUŻ jest komuś udostępniona. Bez niej człowiek musiałby
            otwierać menu, żeby się dowiedzieć — a to jest informacja o cudzym dostępie
            do własnej pracy i ma być widoczna bez klikania. */}
        {shares.length > 0 && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-desk-pill bg-desk-accent" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 min-w-[260px] rounded-md border bg-desk-surface p-3 shadow-desk-pop"
        >
          <div className="t-section flex items-center gap-2 pb-2">
            <Icon as={Share2} px={14} /> {translate("share.title")}
          </div>

          <ul className="space-y-1">
            {shares.length === 0 && <li className="t-meta">{translate("share.nobody")}</li>}
            {shares.map((s) => (
              <li key={s.who} className="flex items-center gap-2">
                <span className="t-body min-w-0 flex-1 truncate">{name(s.who)}</span>
                {everyone.length > 0 && (
                  <button
                    onClick={() => act({ action: "unshare", who: s.who })}
                    disabled={taken}
                    aria-label={translate("share.stop", { name: name(s.who) })}
                    title={translate("share.stop", { name: name(s.who) })}
                    className="grid h-6 w-6 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-bad"
                  >
                    <Icon as={X} px={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {canInvite.length > 0 && (
            <>
              <div className="t-micro flex items-center gap-1.5 pb-1 pt-3">
                <Icon as={UserPlus} px={12} /> {translate("share.addSomeone")}
              </div>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {canInvite.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => act({ action: "share", who: u.id })}
                      disabled={taken}
                      className="t-body flex h-8 w-full items-center rounded-sm px-2 text-left hover:bg-desk-raised disabled:opacity-50"
                    >
                      {u.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {shares.length > 0 && (
            <button
              onClick={copyLink}
              className="t-btn mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border hover:bg-desk-raised"
            >
              <Icon as={copied ? Check : Link2} px={14} />
              {copied ? translate("share.linkCopied") : translate("share.copyLink")}
            </button>
          )}

          {/* Zdanie stoi na dole i mówi DOKŁADNIE, co dostaje druga osoba. Bez niego
              „udostępniam" znaczy tyle, ile każdy sobie dopowie — a dopowiedzenie
              „może to zmienić" jest przy pracy księgowej kosztowne. */}
          <p className="t-micro pt-3">{translate("share.viewOnly")}</p>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
