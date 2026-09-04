"use client"
import type { Policy } from "@cortex/desk-core/types"
import { LoaderCircle, Paperclip } from "lucide-react"
import { useEffect, useId, useRef, useState, type RefObject } from "react"
import { useDeskT } from "../i18n/client"
import { AttachmentList, type Attachment } from "./attachments"
import { CapabilityButton } from "./capability-list"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * PRZEGLĄDARKA DOMYŚLNIE OTWIERA UPUSZCZONY PLIK — i to jest najgorszy możliwy skutek
 * chybionego celu: sprawa znika z ekranu, a człowiek nie wie, co się stało i jak wrócić.
 *
 * Blokada stoi na CAŁYM dokumencie, bo chybić da się wszędzie, ale wyłącznie w fazie
 * bąbelkowania i tylko wtedy, gdy nikt inny tego nie obsłużył (`defaultPrevented`).
 * Inaczej zabiłaby upuszczanie w „Moich plikach", które działa i ma zostać.
 */
function useDropDoesNotLeaveTheApp() {
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (e.defaultPrevented) return
      e.preventDefault()
    }
    document.addEventListener("dragover", swallow)
    document.addEventListener("drop", swallow)
    return () => {
      document.removeEventListener("dragover", swallow)
      document.removeEventListener("drop", swallow)
    }
  }, [])
}

/** Czy w tym, co ktoś ciągnie, są w ogóle PLIKI — a nie zaznaczony tekst albo odnośnik. */
const carriesFiles = (t: DataTransfer | null) =>
  Boolean(t) && Array.from(t!.types).includes("Files")

/**
 * Czy wśród upuszczonych rzeczy jest KATALOG. Przeglądarka oddaje go w `files` jako wpis
 * o zerowym rozmiarze i pustym typie, więc bez tego sprawdzenia człowiek upuściłby folder
 * faktur i nie dostał ani pliku, ani zdania — czyli ciszę w miejscu, w którym spodziewa się
 * dwudziestu czterech dokumentów.
 */
function hasFolder(t: DataTransfer): boolean {
  for (const item of Array.from(t.items)) {
    const entry = (
      item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory: boolean } | null }
    ).webkitGetAsEntry?.()
    if (entry?.isDirectory) return true
  }
  return false
}

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
  const { toast } = useToast()
  const picker = useRef<HTMLInputElement>(null)
  const id = useId()
  const hintId = `${id}-hint`
  const [over, setOver] = useState(false)
  /**
   * `dragenter` i `dragleave` strzelają TAKŻE z każdego dziecka ramki, więc przesunięcie
   * kursora z obramowania na pole tekstowe wygląda jak wyjście. Licznik znosi zagnieżdżenie —
   * ten sam chwyt, co w `file-explorer.tsx`.
   */
  const depth = useRef(0)
  useDropDoesNotLeaveTheApp()
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
      {/* CELEM JEST CAŁA RAMKA, nie samo pole tekstowe. Człowiek celuje w prostokąt,
          który widzi; trzy piksele obok trafiałyby w dokument, a plik otworzyłby się
          zamiast dołączyć. Uchwyty siedzą tu, a nie na `textarea`, właśnie dlatego. */}
      <div
        data-drop="task"
        onDragEnter={(e) => {
          if (!carriesFiles(e.dataTransfer)) return
          e.preventDefault()
          depth.current += 1
          setOver(true)
        }}
        onDragOver={(e) => {
          // Bez tego przeglądarka odmawia upuszczenia — `dragover` musi być przechwycony
          // przy KAŻDYM ruchu, nie tylko przy wejściu.
          if (carriesFiles(e.dataTransfer)) e.preventDefault()
        }}
        onDragLeave={() => {
          depth.current -= 1
          if (depth.current <= 0) {
            depth.current = 0
            setOver(false)
          }
        }}
        onDrop={(e) => {
          if (!carriesFiles(e.dataTransfer)) return
          e.preventDefault()
          depth.current = 0
          setOver(false)
          if (hasFolder(e.dataTransfer)) {
            // Zdanie zamiast ciszy. Katalog wygląda jak plik i upuszcza się tak samo,
            // a bez tego człowiek zobaczyłby, że „nic się nie stało".
            toast({ text: translate("case.dropFolder"), tone: "error" })
            return
          }
          onFiles(e.dataTransfer.files)
        }}
        className={`editor relative rounded-xl border bg-desk-surface shadow-desk-pop ${
          over ? "border-desk-accent ring-2 ring-desk-accent-soft" : ""
        }`}
      >
        {/* Zdanie, a nie sama ramka: „coś się podświetliło" nie mówi, CO się stanie
            po puszczeniu. `pointer-events-none`, żeby nakładka nie przejęła upuszczenia
            i nie wywołała `dragleave` w chwili, w której kursor nad nią wjeżdża. */}
        {over && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-desk-surface/90">
            <span className="t-body-m text-desk-accent">{translate("case.dropHere")}</span>
          </div>
        )}
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
