"use client"
import { capabilityLabel } from "@cortex/desk-core/capability-text"
import { Lock, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useDeskT } from "../i18n/client"
import { api, t } from "../routes"
import { Icon } from "./icon"
import { OtherRequest } from "./other-request"
import { useToast } from "./toast"

/**
 * Moment, w którym governance przestaje być slajdem i staje się rzeczą na ekranie.
 * Kłódka jest szara, nie pomarańczowa ani czerwona — to nie awaria, tylko polityka firmy.
 *
 * KAŻDA ODMOWA KOŃCZY SIĘ CZYNNOŚCIĄ, i to jest tu regułą, a nie zdobieniem. Do tej pory
 * cały przycisk wisiał na `capabilityId`: gdy opis, którego odmówił model, nie trafił
 * w katalog zdolności — a katalog jest krótki i kurowany, więc nie trafia często —
 * karta kończyła się zdaniem i niczym. Człowiek zostawał przed ścianą, na której nie ma
 * nawet klamki. Teraz są DWA wyjścia i zawsze któreś z nich stoi:
 *   · zdolność Z KATALOGU  → prośba jednym kliknięciem, do rozpatrzenia przez przełożonego;
 *   · cokolwiek POZA nim   → okno z już wpisanym zdaniem asystenta, własnymi słowami.
 *
 * DZIAŁ USTĘPUJE IMIENIU. Kartka mówiła wcześniej „zgodę wydaje dział Finanse" — czyli
 * kierowała do bytu, do którego nie da się podejść i zapytać. Decyduje rola `management`,
 * a więc konkretna osoba; jej imię i nazwisko stoi tuż nad przyciskiem. Gdy Biurko nie
 * umie tej osoby wskazać (patrz `approver()` w `people.ts` — kilku przełożonych albo
 * żaden), zostaje zdanie zapasowe bez imienia, a przycisk działa tak samo: prośba i tak
 * trafia do kolejki.
 */
export function CapabilityLock({
  description,
  name,
  capabilityId,
  alreadyRequested,
  approver,
  iAmTheApprover,
}: {
  description: string
  /** Nazwa zapisana w STARYM zdarzeniu; nowe niosą samo `capabilityId`. */
  name?: string | undefined
  capabilityId?: string | undefined
  alreadyRequested?: boolean | undefined
  /** „Imię Nazwisko" osoby wydającej zgodę; pusto, gdy Biurko nie umie jej wskazać. */
  approver?: string | undefined
  /**
   * CZY OGLĄDAJĄCY JEST TĄ OSOBĄ. Bez tego kartka mówiła przełożonemu „Zgodę wydaje
   * Robert Nowak, Twój przełożony" — czyli odsyłała go do niego samego, i to na koncie,
   * na którym on jako jedyny w firmie może tę zgodę wydać. Wyglądało to na usterkę
   * produktu dokładnie u tej osoby, która ma go komuś sprzedać.
   */
  iAmTheApprover?: boolean | undefined
}) {
  // Nazwa powstaje TU, przy renderze, w języku tej osoby — zdarzenie niesie tożsamość.
  // Napis ze starego zdarzenia zostaje jako zapasowy, bo tamtych spraw nie przepisujemy.
  const translate = useDeskT()
  const label = capabilityLabel(translate, capabilityId, name ?? "")
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
    toast({ text: translate("lock.requestSent", { name: label }) })
  }

  return (
    <div className="flex max-w-desk-measure gap-2.5 rounded-lg border bg-desk-surface px-3.5 py-3">
      <Icon as={Lock} px={16} className="mt-0.5 shrink-0 text-desk-muted" />
      <div className="min-w-0">
        <div className="t-body">
          {label ? translate("lock.needs", { name: label }) : translate("lock.notAllowed")}
        </div>
        <div className="t-meta mt-0.5">{translate("lock.about", { description })}</div>
        {/* Zdanie o tym, KTO decyduje, stoi bezpośrednio nad przyciskiem: człowiek ma
            przeczytać imię i czynność jednym spojrzeniem, a nie szukać nazwiska
            dwa akapity wyżej. */}
        <div className="t-meta mt-1.5 text-desk-ink">
          {iAmTheApprover
            ? translate("lock.youDecide")
            : approver
              ? translate("lock.decidedBy", { person: approver })
              : translate("lock.decidedByAnyone")}
        </div>
        {iAmTheApprover && capabilityId ? (
          /* Przełożony nie prosi sam siebie — dostaje DROGĘ do włączenia. Zostawienie
             tu przycisku „Poproś o zgodę" znaczyłoby wpis w kolejce, który on sam za
             chwilę zatwierdzi: ceremonia bez treści. */
          <Link
            href={t("/supervision?section=team")}
            className="t-btn mt-2 inline-block rounded-md border px-2.5 py-1 hover:bg-desk-raised"
          >
            {translate("lock.turnItOn")}
          </Link>
        ) : sent ? (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-desk-ok">
            <Icon as={ShieldCheck} px={12} /> {translate("capabilities.requestSent")}
          </div>
        ) : capabilityId ? (
          <button
            onClick={request}
            disabled={taken}
            className="t-btn mt-2 rounded-md border px-2.5 py-1 hover:bg-desk-raised disabled:opacity-50"
          >
            {translate("lock.askForApproval")}
          </button>
        ) : (
          <div className="mt-2">
            <OtherRequest
              defaultText={description}
              approver={approver}
              label={translate("lock.writeWhatYouNeed")}
              onSent={() => setSent(true)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
