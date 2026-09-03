"use client"
import * as Dialog from "@radix-ui/react-dialog"
import { MessageSquarePlus, X } from "lucide-react"
import { useState } from "react"
import { useDeskT } from "../i18n/client"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * Katalog zdolności jest z założenia krótki i kurowany — a praca ma długi ogon.
 * To jest kanał na wszystko, czego w katalogu nie ma: nie da się tego przyznać
 * kliknięciem i nie udajemy, że się da. Trafia do przełożonego jako sygnał.
 *
 * OKNO OTWIERA SIĘ TAKŻE Z KARTY ODMOWY, i to jest jego drugie, ważniejsze wejście.
 * Gdy opis zdolności nie trafił w katalog, karta nie ma czego poprosić jednym
 * kliknięciem — ale wciąż ma dokąd wysłać człowieka. `defaultText` wpisuje wtedy
 * z góry zdanie asystenta, żeby pani Basia nie musiała sama nazywać rzeczy,
 * której nazwy nie zna.
 *
 * ZDANIE O PRYWATNOŚCI JEST TU WARUNKIEM, NIE OZDOBĄ. Ułatwienie „przeczytaj
 * i wyślij" bez niego robi z treści sprawy ścieżkę najmniejszego oporu: człowiek
 * dokleja do prośby fragment faktury, bo nie wie, że wysyła dokładnie to, co widzi.
 */
export function OtherRequest({
  defaultText = "",
  approver,
  label,
  title,
  lead,
  placeholder,
  onSent,
}: {
  /** Zdanie, z którym okno się otwiera — opis z odmowy, gotowy do poprawienia. */
  defaultText?: string
  /** „Imię Nazwisko" osoby wydającej zgodę; pusto, gdy Biurko nie umie jej wskazać. */
  approver?: string | undefined
  /** Napis na przycisku otwierającym; domyślnie zdanie z ekranu „Co potrafię". */
  label?: string | undefined
  /**
   * Trzy napisy okna — nagłówek, zdanie wprowadzające i podpowiedź w polu — do
   * PODMIANY, nie do dopisania obok.
   *
   * Ekran „Jak to robimy" prosi o co innego niż ekran „Co potrafię": tam brakuje
   * umiejętności, tutaj spisanej zasady. Domyślne zdanie („stanie się nową
   * umiejętnością") byłoby wtedy nieprawdą — a droga prośby ma zostać JEDNA,
   * bo druga znaczyłaby drugą skrzynkę, do której przełożony musi pamiętać zajrzeć.
   */
  title?: string | undefined
  lead?: string | undefined
  placeholder?: string | undefined
  onSent?: (() => void) | undefined
}) {
  const [openItems, setOpenItems] = useState(false)
  const [text, setText] = useState(defaultText)
  const [taken, setTaken] = useState(false)
  const { toast } = useToast()
  const translate = useDeskT()

  // Okno otwiera się ZAWSZE z tekstem wyjściowym, także za drugim razem: człowiek,
  // który je zamknął i wrócił, ma zobaczyć to samo zdanie, a nie swój porzucony szkic.
  function change(next: boolean) {
    setOpenItems(next)
    if (next) setText(defaultText)
  }

  async function send() {
    if (!text.trim() || taken) return
    setTaken(true)
    const r = await fetch(api("/request"), {
      method: "POST",
      body: JSON.stringify({ capability: "other", justification: text }),
    })
    setTaken(false)
    if (!r.ok) {
      toast({ text: translate("lock.requestFailed"), tone: "error" })
      return
    }
    setOpenItems(false)
    setText("")
    onSent?.()
    toast({ text: translate("otherRequest.sent") })
  }

  return (
    <Dialog.Root open={openItems} onOpenChange={change}>
      <Dialog.Trigger className="t-btn flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-desk-raised">
        <Icon as={MessageSquarePlus} px={16} className="text-desk-muted" />
        {label ?? translate("otherRequest.trigger")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-desk-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-desk-surface shadow-desk-window">
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="t-h3">
                {title ?? translate("otherRequest.title")}
              </Dialog.Title>
              <Dialog.Description className="t-meta">
                {lead ?? translate("otherRequest.lead")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={translate("common.close")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
            >
              <Icon as={X} px={16} />
            </Dialog.Close>
          </div>
          <div className="p-4">
            <p className="t-meta mb-2">
              {approver
                ? translate("otherRequest.privacy", { person: approver })
                : translate("otherRequest.privacyAnyone")}
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              aria-label={translate("otherRequest.field")}
              placeholder={placeholder ?? translate("otherRequest.placeholder")}
              className="t-body w-full resize-none rounded-md border bg-desk-bg px-3 py-2 outline-none placeholder:text-desk-muted-2"
            />
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <Dialog.Close className="t-btn rounded-md border px-3 py-1.5 hover:bg-desk-raised">
              {translate("common.cancel")}
            </Dialog.Close>
            <button
              onClick={send}
              disabled={!text.trim() || taken}
              className="t-btn rounded-md bg-desk-accent px-3 py-1.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-40"
            >
              {translate("otherRequest.send")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
