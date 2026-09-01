"use client"
import * as Dialog from "@radix-ui/react-dialog"
import { MessageSquarePlus, X } from "lucide-react"
import { useState } from "react"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * Katalog zdolności jest z założenia krótki i kurowany — a praca ma długi ogon.
 * To jest kanał na wszystko, czego w katalogu nie ma: nie da się tego przyznać
 * kliknięciem i nie udajemy, że się da. Trafia do przełożonego jako sygnał.
 */
export function OtherRequest() {
  const [openItems, setOpenItems] = useState(false)
  const [text, setText] = useState("")
  const [taken, setTaken] = useState(false)
  const { toast } = useToast()

  async function send() {
    if (!text.trim() || taken) return
    setTaken(true)
    const r = await fetch(api("/request"), {
      method: "POST",
      body: JSON.stringify({ capability: "other", justification: text }),
    })
    setTaken(false)
    if (!r.ok) {
      toast({ text: "Nie udało się wysłać prośby.", tone: "error" })
      return
    }
    setOpenItems(false)
    setText("")
    toast({ text: "Prośba poszła do przełożonego. Odezwie się, gdy ją rozpatrzy." })
  }

  return (
    <Dialog.Root open={openItems} onOpenChange={setOpenItems}>
      <Dialog.Trigger className="t-btn flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-raised">
        <Icon as={MessageSquarePlus} px={16} className="text-cichy" />
        Potrzebuję czegoś innego
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-surface shadow-okno">
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="t-h3">Napisz, czego potrzebujesz</Dialog.Title>
              <Dialog.Description className="t-meta">
                To trafi do przełożonego. Jeśli okaże się przydatne dla większej liczby osób, stanie
                się nową umiejętnością.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Zamknij"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-cichy hover:bg-raised"
            >
              <Icon as={X} px={16} />
            </Dialog.Close>
          </div>
          <div className="p-4">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              aria-label="Czego potrzebujesz"
              placeholder={
                "np. „Żeby asystent umiał wystawić fakturę w naszym systemie” albo „Żeby czytał pliki z dysku sieciowego działu”"
              }
              className="t-tresc w-full resize-none rounded-md border bg-bg px-3 py-2 outline-none placeholder:text-cichy-2"
            />
          </div>
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <Dialog.Close className="t-btn rounded-md border px-3 py-1.5 hover:bg-raised">
              Anuluj
            </Dialog.Close>
            <button
              onClick={send}
              disabled={!text.trim() || taken}
              className="t-btn rounded-md bg-akcent px-3 py-1.5 text-akcent-ink hover:bg-akcent-hover disabled:opacity-40"
            >
              Wyślij prośbę
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
