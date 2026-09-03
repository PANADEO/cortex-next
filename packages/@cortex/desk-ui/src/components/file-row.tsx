"use client"
import type { FileMeta } from "@cortex/desk-core/types"
import * as Menu from "@radix-ui/react-dropdown-menu"
import type { LucideIcon } from "lucide-react"
import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder,
  FolderInput,
  FolderOutput,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { size, when } from "../lib"
import { t } from "../routes"
import { Icon } from "./icon"

export function fileIcon(p: { name: string; folder: boolean }): LucideIcon {
  if (p.folder) return Folder
  if (/\.(csv|xlsx?|tsv)$/i.test(p.name)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p.name)) return FileImage
  if (/\.pdf$/i.test(p.name)) return FileType
  return FileText
}

/** Rozszerzenie musi zostać widoczne — księgowa odróżnia .csv od .md właśnie po nim. */
function splitName(n: string) {
  const i = n.lastIndexOf(".")
  return i > 0 ? { core: n.slice(0, i), ext: n.slice(i) } : { core: n, ext: "" }
}

export type FileActions = {
  preview?: (p: FileMeta) => void
  download?: (p: FileMeta) => void
  rename?: (p: FileMeta, isNew: string) => Promise<string | null>
  move?: (p: FileMeta) => void
  toMyFiles?: (p: FileMeta) => void
  toCase?: (p: FileMeta) => void
  remove?: (p: FileMeta) => void
  openFolder?: (p: FileMeta) => void
}

export function FileRow({
  p,
  actions,
  active,
  origin,
  picked,
  pick,
}: {
  p: FileMeta
  actions: FileActions
  active?: boolean
  /**
   * Zaznaczenie do działania zbiorczego. `undefined` znaczy: ten ekran nie zaznacza
   * niczego (tak jest z załącznikami sprawy) — i wtedy pola wyboru w ogóle nie ma,
   * zamiast stać wyłączone i pytać, po co tam jest.
   */
  picked?: boolean | undefined
  pick?: ((path: string, shift: boolean) => void) | undefined
  /**
   * Sprawa, z której ten plik przyszedł — WYŁĄCZNIE gdy istnieje na to zdarzenie.
   * Plik bez pochodzenia nie dostaje żadnej plakietki, a w szczególności nie dostaje
   * napisu „wgrany przez Ciebie": brak dowodu nie jest dowodem.
   */
  origin?: { caseId: string; title: string }
}) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { core, ext } = splitName(p.name)

  useEffect(() => {
    if (!editing) return
    const el = field.current
    if (!el) return
    el.focus()
    // zaznaczamy sam rdzeń — rozszerzenia nikt nie chce przepisywać
    el.setSelectionRange(0, splitName(el.value).core.length)
  }, [editing])

  async function saveName() {
    const isNew = field.current?.value.trim()
    if (!isNew || isNew === p.name) {
      setEditing(false)
      setError(null)
      return
    }
    const b = await actions.rename?.(p, isNew)
    if (b) setError(b)
    else {
      setEditing(false)
      setError(null)
    }
  }

  const main = () => {
    if (p.folder) actions.openFolder?.(p)
    else actions.preview?.(p)
  }

  // menu obiecuje F2 i Delete — więc muszą działać, nie tylko widnieć jako napis
  function shortcuts(e: React.KeyboardEvent) {
    if (editing) return
    if (e.key === "F2" && actions.rename) {
      e.preventDefault()
      setEditing(true)
    }
    if (e.key === "Delete" && actions.remove) {
      e.preventDefault()
      actions.remove(p)
    }
  }

  return (
    <li className={active ? "bg-desk-raised" : undefined}>
      <div
        onKeyDown={shortcuts}
        className={`group flex h-desk-row items-center gap-2 px-3 ${picked ? "bg-desk-accent-soft" : "hover:bg-desk-raised/60"}`}
      >
        {/* POLE WYBORU STOI ZAWSZE, i to jest cała zmiana z 03.09.2026.
            Wcześniej dzieliło miejsce z ikoną typu i wychodziło z ukrycia dopiero pod
            myszą — a rzecz, na którą trzeba najechać, żeby się dowiedzieć, że istnieje,
            nie istnieje dla nikogo, kto o niej nie wie. Zaznaczanie wielu plików było
            więc funkcją dla tych, którzy ją już znali. Kwadracik po lewej stronie wiersza
            pani Basia widziała w poczcie i na dysku firmowym; to jest znana forma.
            Ikona typu przestaje się z nim przepychać i dostaje własne miejsce, bo
            rozszerzenie odróżnia .csv od .md i nie ma go po co tracić. */}
        {pick && (
          <input
            type="checkbox"
            checked={Boolean(picked)}
            // Zaznaczenie zakresem: Shift bierze wszystko od ostatniego kliknięcia.
            // Bez tego „zaznacz te dwadzieścia" to dwadzieścia kliknięć, czyli ten
            // sam problem, który to zaznaczanie ma rozwiązać.
            onClick={(e) => pick(p.path, e.shiftKey)}
            onChange={() => {}}
            aria-label={translate("files.pick", { name: p.name })}
            className="h-4 w-4 shrink-0 accent-desk-accent"
          />
        )}
        <span className="grid w-7 shrink-0 place-items-center text-desk-muted">
          <Icon as={fileIcon(p)} px={16} />
        </span>

        {editing ? (
          <input
            ref={field}
            defaultValue={p.name}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void saveName()
              }
              if (e.key === "Escape") {
                setEditing(false)
                setError(null)
              }
            }}
            onBeforeInput={(e) => {
              const d = (e as unknown as { data?: string }).data
              if (d && (d.includes("/") || d.includes("\\"))) e.preventDefault()
            }}
            onBlur={() => void saveName()}
            aria-label={translate("fileRow.newName")}
            className="t-body min-w-0 flex-1 rounded-sm border bg-desk-bg px-1.5 py-0.5 outline-none"
          />
        ) : (
          <button onClick={main} className="t-body-m flex min-w-0 flex-1 items-center text-left">
            <span className="truncate">{core}</span>
            <span className="shrink-0 text-desk-muted">{ext}</span>
          </button>
        )}

        {origin && (
          // Link, nie napis — to jedyna droga powrotna od wyniku do jego uzasadnienia.
          //
          // PLAKIETKA ALBO JEJ BRAK, nigdy sama ikona. Do 03.09.2026 poniżej 640 px znikał
          // sam TYTUŁ (`hidden sm:inline`) i zostawała goła chmurka z dymkiem — a dymka nie
          // ma czym wywołać na ekranie dotykowym, więc na telefonie stał tu znaczek, którego
          // nikt nie miał jak odczytać. Zejście tytułu do jednego wyrazu też nie jest
          // wyjściem: przy 360 px plakietka zjadała nazwę pliku do trzech liter, a nazwa
          // jest w tym wierszu treścią, plakietka tylko przypisem.
          // Poniżej 640 px plakietka wypada więc W CAŁOŚCI, a droga powrotna zostaje —
          // „Otwórz sprawę, z której przyszedł" stoi w menu pod trzema kropkami, które
          // od tej samej poprawki widać bez najeżdżania.
          <a
            href={t(`/case/${origin.caseId}`)}
            // Nazwa dla czytnika ZAWIERA widoczny tytuł i dokłada mu zdanie („Ze sprawy: …"),
            // więc oko i ucho nie rozjeżdżają się — dopowiada, nie podmienia.
            aria-label={translate("fileRow.fromCase", { title: origin.title })}
            title={translate("fileRow.fromCase", { title: origin.title })}
            className="t-micro hidden max-w-[11rem] shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-desk-muted hover:bg-desk-raised hover:text-desk-ink sm:flex"
          >
            <Icon as={MessageSquareText} px={12} className="shrink-0" />
            <span className="min-w-0 truncate">{origin.title}</span>
          </a>
        )}

        <span className="t-meta hidden shrink-0 tabular-nums sm:block">
          {p.folder ? "" : size(p.size)}
        </span>
        <span className="t-meta hidden w-24 shrink-0 text-right tabular-nums sm:block">
          {when(p.modifiedAt, locale)}
        </span>

        <Menu.Root>
          {/* TRZY KROPKI STOJĄ ZAWSZE. Do 03.09.2026 wychodziły spod `opacity-0` dopiero
              pod myszą, a za nimi leży WSZYSTKO, co da się z plikiem zrobić: podgląd,
              pobranie, zmiana nazwy, przeniesienie, usunięcie. Dla kogoś, kto nie wie,
              że tam coś jest, plik nie miał więc żadnych czynności — a to jest dokładnie
              ta osoba, dla której ten produkt powstał.
              Same kropki zostają bez podpisu świadomie: to jest znana forma („więcej"
              w poczcie, w Teamsach, w telefonie), a nie ikona-zagadka, i cała jej treść
              stoi rozpisana słowami w menu, które otwiera. Warunkiem jest to, żeby dało
              się ją zobaczyć bez najeżdżania — i to jest właśnie ta poprawka. */}
          <Menu.Trigger
            aria-label={translate("fileRow.more", { name: p.name })}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
          >
            <Icon as={MoreHorizontal} px={16} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="end"
              sideOffset={4}
              // po zamknięciu Radix domyślnie oddaje fokus wyzwalaczowi — a my przy „Zmień nazwę"
              // chcemy go w polu edycji, więc przejmujemy to na siebie
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="z-50 min-w-[220px] overflow-hidden rounded-md border bg-desk-surface py-1 shadow-desk-pop"
            >
              {origin && (
                <MenuItem
                  icon={MessageSquareText}
                  label={translate("fileRow.openCase")}
                  href={t(`/case/${origin.caseId}`)}
                />
              )}
              {origin && <Divider />}
              {!p.folder && actions.preview && (
                <MenuItem
                  icon={Eye}
                  label={translate("fileRow.preview")}
                  shortcut="Enter"
                  na={() => actions.preview?.(p)}
                />
              )}
              {!p.folder && actions.download && (
                <MenuItem
                  icon={Download}
                  label={translate("files.download")}
                  na={() => actions.download?.(p)}
                />
              )}
              {actions.rename && <Divider />}
              {actions.rename && (
                <MenuItem
                  icon={Pencil}
                  label={translate("fileRow.rename")}
                  shortcut="F2"
                  na={() => setEditing(true)}
                />
              )}
              {actions.move && (
                <MenuItem
                  icon={FolderInput}
                  label={translate("fileRow.moveTo")}
                  na={() => actions.move?.(p)}
                />
              )}
              {actions.toCase && (
                <MenuItem
                  icon={FolderOutput}
                  label={translate("fileRow.toCase")}
                  na={() => actions.toCase?.(p)}
                />
              )}
              {actions.toMyFiles && (
                <MenuItem
                  icon={FolderOutput}
                  label={translate("fileRow.toMyFiles")}
                  na={() => actions.toMyFiles?.(p)}
                />
              )}
              {actions.remove && <Divider />}
              {actions.remove && (
                <MenuItem
                  icon={Trash2}
                  label={translate("fileRow.remove")}
                  shortcut="Delete"
                  dangerous
                  na={() => actions.remove?.(p)}
                />
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      {error && <div className="px-3 pb-2 pl-12 text-[12px] text-desk-bad">{error}</div>}
    </li>
  )
}

function Divider() {
  return <Menu.Separator className="my-1 h-px bg-desk-line" />
}

/**
 * Pozycja menu bywa DZIAŁANIEM na pliku (`na`) albo PRZEJŚCIEM (`href`) — i przejście
 * musi zostać zwykłym `<a>`, żeby działał środkowy przycisk myszy i „otwórz w nowej karcie".
 */
function MenuItem({
  icon,
  label,
  shortcut,
  na,
  href,
  dangerous,
}: {
  icon: LucideIcon
  label: string
  shortcut?: string
  na?: () => void
  href?: string
  dangerous?: boolean
}) {
  const inside = (
    <>
      <Icon as={icon} px={16} className={dangerous ? undefined : "text-desk-muted"} />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="t-micro">{shortcut}</span>}
    </>
  )
  const look = `t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised ${dangerous ? "text-desk-bad" : ""}`
  if (href) {
    return (
      <Menu.Item asChild className={look}>
        <a href={href}>{inside}</a>
      </Menu.Item>
    )
  }
  return (
    <Menu.Item onSelect={() => na?.()} className={look}>
      {inside}
    </Menu.Item>
  )
}
