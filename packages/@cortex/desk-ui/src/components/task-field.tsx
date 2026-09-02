"use client"
import type { Policy } from "@cortex/desk-core/types"
import { LoaderCircle, Paperclip } from "lucide-react"
import { useId, useRef, type RefObject } from "react"
import { useDeskT } from "../i18n/client"
import { AttachmentList, type Attachment } from "./attachments"
import { CapabilityButton } from "./capability-list"
import { Icon } from "./icon"

/**
 * POLE ZLECENIA MA JEDNĄ POSTAĆ — na biurku i na dole sprawy, przy każdej szerokości okna.
 *
 * DLACZEGO POWSTAŁO. Pole żyło w dwóch miejscach jako dwa osobne kawałki kodu, a na biurku
 * miało jeszcze trzy warianty zależne od LICZBY SPRAW: karty przy pustym biurku, chipy przy
 * kilku sprawach, zwinięte „Podpowiedzi” przy pełnym. Ten sam ekran wyglądał w poniedziałek
 * inaczej niż w piątek, więc nie dało się go nauczyć — a pani Basia uczy się ekranu raz
 * i wraca do niego jak do szuflady. Nośnik ma wynikać z RODZAJU rzeczy, nigdy z szerokości
 * okna ani z licznika spraw.
 *
 * TRZY RZECZY, KTÓRYCH TO POLE PILNUJE, w kolejności ważności:
 *   1. etykieta stoi NAD polem i nie znika przy pisaniu. Tekst zastępczy znikał razem
 *      z jedyną instrukcją, jaką ta osoba miała — po pierwszej literze pole było nieme;
 *   2. przykład jest zwykłym zdaniem pod etykietą, a nie szarym napisem w pustym polu.
 *      Kolorem się tego nie ratowało: `--desk-muted` daje na tej powierzchni 4,40:1,
 *      czyli poniżej progu. Pole zostaje puste i problem znika razem z tekstem;
 *   3. przycisk niesie SŁOWO, nie samą strzałkę. Ikona bez podpisu jest zagadką, a osoba,
 *      która boi się, że coś zepsuje, zagadek nie klika.
 *
 * Żadna klasa w tym drzewie nie ma przedrostka szerokości (`sm:`, `md:`, `lg:`…) — pilnuje
 * tego test, bo to jedyna droga, którą druga postać mogłaby tu wrócić po cichu.
 */
export function TaskField({
  text,
  onText,
  hint,
  box,
  busy,
  files,
  removeFile,
  onFiles,
  onSend,
  policyFor: p,
}: {
  text: string
  onText: (value: string) => void
  /** Zdanie pod etykietą: przykład zlecenia, a przy pracy — informacja, na co czekamy. */
  hint: string
  /** Właściciel pola trzyma referencję, bo to on ustawia kursor po wstawieniu treści. */
  box: RefObject<HTMLTextAreaElement>
  busy: boolean
  files: Attachment[]
  removeFile: (name: string) => void
  onFiles: (files: FileList | null) => void
  onSend: () => void
  policyFor: Policy
}) {
  const translate = useDeskT()
  const picker = useRef<HTMLInputElement>(null)
  const id = useId()
  const hintId = `${id}-hint`
  const empty = !text.trim() && files.length === 0
  const blocked = empty || busy || files.some((z) => z.uploading)

  return (
    <div>
      <label htmlFor={id} className="t-body-m block">
        {translate("case.placeholder")}
      </label>
      <p id={hintId} className="t-meta mb-2 mt-0.5">
        {hint}
      </p>
      <div className="editor rounded-xl border bg-desk-surface shadow-desk-pop">
        {files.length > 0 && (
          <div className="max-h-[136px] overflow-y-auto border-b px-3 py-2.5">
            <AttachmentList files={files} remove={removeFile} />
          </div>
        )}
        <textarea
          id={id}
          ref={box}
          value={text}
          aria-describedby={hintId}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            // Enter wysyła tylko tam, gdzie jest myszka. Na telefonie Enter to nowa linia,
            // bo tam nie ma czym zrobić Shift+Enter.
            if (window.matchMedia("(hover: hover)").matches && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)
            if (!pasted.length) return
            e.preventDefault()
            const carrier = new DataTransfer()
            pasted.forEach((f) => carrier.items.add(f))
            onFiles(carrier.files)
          }}
          className="t-body w-full resize-none bg-transparent px-4 pt-3.5 outline-none"
        />
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              onFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            // `whitespace-nowrap`: na 360 px etykiety łamały się w środku wyrazu
            // („Dodaj / plik”, „Umiem tu 6 / rzeczy”) i pasek wyglądał na zepsuty.
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-[13px] text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
          >
            <Icon as={Paperclip} px={14} /> {translate("case.addFile")}
          </button>
          <CapabilityButton p={p} />
          <div className="flex-1" />
          <button
            type="button"
            onClick={onSend}
            disabled={blocked}
            className="t-btn flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-desk-accent px-3.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-35"
          >
            {translate("composer.send")}
            {busy && <Icon as={LoaderCircle} px={16} className="spin" />}
          </button>
        </div>
      </div>
    </div>
  )
}
