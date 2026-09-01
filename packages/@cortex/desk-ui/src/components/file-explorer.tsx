"use client"
import { MY_FILES } from "@cortex/desk-core/folder"
import type { FileMeta } from "@cortex/desk-core/types"
import * as Dialog from "@radix-ui/react-dialog"
import * as Menu from "@radix-ui/react-dropdown-menu"
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  FolderInput,
  FolderPlus,
  Inbox,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { when } from "../lib"
import { api, t } from "../routes"
import { FileRow } from "./file-row"
import { Icon } from "./icon"
import { MoveDialog } from "./move-dialog"
import { Preview, fileUrl } from "./preview"
import { useToast } from "./toast"

type TrashEntry = { id: string; name: string; from: string; when: string }
const ROOT = MY_FILES

/**
 * Porządek listy. Katalogi zostają NAPRZÓD w każdym z nich i zawsze po nazwie —
 * to jest katalog, nie arkusz danych, a katalog o rozmiarze 4 kB nic nie znaczy.
 */
const ORDERS = ["name", "newest", "size"] as const
type Order = (typeof ORDERS)[number]

/**
 * Pole zawężania pokazuje się dopiero wtedy, gdy jest co zawężać. Przy trzech plikach
 * jest szumem, przy pięćdziesięciu jedyną alternatywą jest `Ctrl+F` przeglądarki —
 * które znajduje też tekst spoza listy.
 */
const WORTH_FILTERING = 7

export function FileExplorer() {
  const router = useRouter()
  const params = useSearchParams()
  const folder = params.get("k") ?? ROOT
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()

  const [files, setFiles] = useState<FileMeta[]>([])
  const [origins, setOrigins] = useState<Record<string, { caseId: string; title: string }>>({})
  const [trash, setTrash] = useState<TrashEntry[]>([])
  const [query, setQuery] = useState("")
  // Zaznaczenie żyje w komponencie, nie w adresie: to ruch ręki, nie miejsce, w którym
  // się stoi. Kotwica pamięta ostatnie kliknięcie, żeby Shift brał cały zakres.
  const [picked, setPicked] = useState<string[]>([])
  const anchor = useRef<string | null>(null)
  const [order, setOrder] = useState<Order>("name")
  const [showTrash, setShowTrash] = useState(false)
  const [taken, setTaken] = useState(false)
  const [above, setAbove] = useState(false)
  const [toMove, setToMove] = useState<FileMeta[]>([])
  const [preview, setPreview] = useState<FileMeta | null>(null)
  const [newFolder, setNewFolder] = useState(false)
  const counter = useRef(0)
  const picker = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch(`${api("")}/files?folder=${encodeURIComponent(folder)}`, {
      cache: "no-store",
    })
    const d = await r.json()
    setFiles(d.files ?? [])
    setOrigins(d.origins ?? {})
    setTrash(d.trash ?? [])
  }, [folder])

  useEffect(() => {
    refresh()
    // Zaznaczenie dotyczy TEJ listy: po wejściu do innego katalogu wskazywałoby pliki,
    // których nie widać, a działanie zbiorcze zrobiłoby coś niewidocznego.
    setPicked([])
    anchor.current = null
  }, [refresh])

  const goTo = (k: string) =>
    router.push(k === ROOT ? t("/files") : `${t("/files")}?k=${encodeURIComponent(k)}`)

  async function action(body: Record<string, unknown>) {
    const r = await fetch(api("/files"), { method: "POST", body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    await refresh()
    return { ok: r.ok, status: r.status, ...d }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    const tooLarge = Array.from(files).filter((f) => f.size > 25 * 1024 * 1024)
    if (tooLarge.length) {
      toast({
        text: translate("files.tooLarge", { name: tooLarge[0]!.name }),
        tone: "error",
      })
      return
    }
    setTaken(true)
    const fd = new FormData()
    fd.append("folder", folder)
    Array.from(files).forEach((f) => fd.append("file", f))
    const r = await fetch(api("/files/upload"), { method: "POST", body: fd })
    setTaken(false)
    await refresh()
    toast(
      r.ok
        ? { text: translate("files.uploaded", { count: files.length }) }
        : { text: translate("files.uploadFailed"), tone: "error" },
    )
  }

  async function remove(p: FileMeta) {
    const d = await action({ action: "trash", path: p.path })
    if (!d.ok) {
      toast({ text: translate("files.deleteFailed", { name: p.name }), tone: "error" })
      return
    }
    toast({
      text: translate("files.movedToTrash", { name: p.name }),
      revoke: async () => {
        const w = await action({ action: "restore", id: d.id })
        if (!w.ok) toast({ text: translate("files.undoFailed"), tone: "error" })
      },
    })
  }

  /**
   * Kasowanie zbiorcze z JEDNYM cofnięciem, nie dziesięcioma tostami.
   *
   * Cofnięcie przywraca wszystko, co ta operacja skasowała — nie „ostatni plik".
   * Człowiek podjął jedną decyzję, więc cofa jedną decyzję.
   */
  async function removeMany() {
    const chosen = shown.filter((x) => picked.includes(x.path))
    const ids: string[] = []
    for (const p of chosen) {
      const d = await action({ action: "trash", path: p.path })
      if (d.ok && d.id) ids.push(String(d.id))
    }
    setPicked([])
    if (ids.length === 0) {
      toast({ text: translate("files.deleteManyFailed"), tone: "error" })
      return
    }
    toast({
      text: translate("files.movedManyToTrash", { count: ids.length }),
      revoke: async () => {
        for (const id of ids) await action({ action: "restore", id })
      },
    })
  }

  async function rename(p: FileMeta, nextName: string): Promise<string | null> {
    const d = await action({ action: "move", from: p.path, to: `${folder}/${nextName}` })
    if (d.ok) return null
    return d.error === "name-clash" ? translate("files.nameClash") : translate("files.renameFailed")
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
    const matching = needle
      ? files.filter((p) => p.name.toLocaleLowerCase(locale).includes(needle))
      : files
    const by = (a: FileMeta, b: FileMeta) => {
      if (a.folder !== b.folder) return Number(b.folder) - Number(a.folder)
      if (a.folder) return a.name.localeCompare(b.name, locale)
      if (order === "newest") return b.modifiedAt.localeCompare(a.modifiedAt)
      if (order === "size") return b.size - a.size
      return a.name.localeCompare(b.name, locale)
    }
    return [...matching].sort(by)
  }, [files, query, order, locale])

  const pick = useCallback(
    (path: string, shift: boolean) => {
      setPicked((was) => {
        const rows = shown.map((x) => x.path)
        if (shift && anchor.current) {
          const a = rows.indexOf(anchor.current)
          const b = rows.indexOf(path)
          if (a >= 0 && b >= 0) {
            const range = rows.slice(Math.min(a, b), Math.max(a, b) + 1)
            return [...new Set([...was, ...range])]
          }
        }
        anchor.current = path
        return was.includes(path) ? was.filter((x) => x !== path) : [...was, path]
      })
    },
    // `shown` czytamy w środku, więc musi być w zależnościach — inaczej zakres liczyłby
    // się po nieaktualnej liście i brał nie te pliki, na które człowiek patrzy.
    [shown],
  )

  // Korzeń to nazwa katalogu NA DYSKU, więc na ekranie podmieniamy ją etykietą —
  // ścieżki zapisane w sprawach zostają nietknięte.
  const breadcrumbs = [
    translate("shell.product"),
    ...folder.split("/").map((x) => (x === MY_FILES ? translate("files.myFilesFolder") : x)),
  ]
  const paths = folder.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"))

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        counter.current++
        setAbove(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        counter.current--
        if (counter.current <= 0) setAbove(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        counter.current = 0
        setAbove(false)
        upload(e.dataTransfer.files)
      }}
      className="mx-auto max-w-desk-stream px-5 py-8 pb-24 md:pb-8"
    >
      <h1 className="t-display">{translate("files.title")}</h1>
      <p className="t-body mt-1 text-desk-muted">{translate("files.lead")}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input ref={picker} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button
          onClick={() => picker.current?.click()}
          disabled={taken}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md bg-desk-accent px-3.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-50"
        >
          <Icon as={Upload} px={16} />{" "}
          {taken ? translate("files.uploading") : translate("files.addFiles")}
        </button>
        <button
          onClick={() => setNewFolder(true)}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md border px-3.5 hover:bg-desk-raised"
        >
          <Icon as={FolderPlus} px={16} /> {translate("files.newFolder")}
        </button>
      </div>

      <nav
        aria-label={translate("files.path")}
        className="t-meta mt-4 flex flex-wrap items-center gap-0.5"
      >
        {breadcrumbs.map((o, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <Icon as={ChevronRight} px={12} className="text-desk-muted-2" />}
            {i === 0 ? (
              <span className="text-desk-muted-2">{o}</span>
            ) : i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-desk-ink">{o}</span>
            ) : (
              <button
                onClick={() => goTo(paths[i - 1] ?? "")}
                className="rounded-sm px-1 hover:bg-desk-raised hover:text-desk-ink"
              >
                {o}
              </button>
            )}
          </span>
        ))}
      </nav>

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-desk-accent-soft-line bg-desk-accent-soft px-3 py-2">
          <span className="t-body-m">{translate("files.picked", { count: picked.length })}</span>
          <button
            onClick={() => setPicked([])}
            className="t-micro rounded-desk-pill border px-2 py-0.5 hover:bg-desk-raised"
          >
            {translate("files.unpick")}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setToMove(shown.filter((x) => picked.includes(x.path)))}
            className="t-btn flex h-8 items-center gap-1.5 rounded-md border bg-desk-surface px-3 hover:bg-desk-raised"
          >
            <Icon as={FolderInput} px={14} /> {translate("fileRow.moveTo")}
          </button>
          <button
            onClick={removeMany}
            className="t-btn flex h-8 items-center gap-1.5 rounded-md border bg-desk-surface px-3 text-desk-bad hover:bg-desk-raised"
          >
            <Icon as={Trash2} px={14} /> {translate("fileRow.remove")}
          </button>
        </div>
      )}

      {picked.length === 0 && (files.length > WORTH_FILTERING || query) && (
        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Icon
              as={Search}
              px={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-desk-muted-2"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              autoComplete="off"
              spellCheck={false}
              aria-label={translate("files.find")}
              placeholder={translate("files.findPlaceholder")}
              className="t-body h-9 w-full rounded-md border bg-desk-surface pl-8 pr-2 outline-none focus-visible:border-desk-accent"
            />
          </div>
          <Menu.Root>
            <Menu.Trigger className="t-btn flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-desk-muted hover:bg-desk-raised hover:text-desk-ink">
              <Icon as={ArrowDownUp} px={14} />
              <span className="hidden sm:inline">{translate(`files.order.${order}`)}</span>
              <span className="sr-only sm:hidden">{translate("files.order.label")}</span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[180px] overflow-hidden rounded-md border bg-desk-surface py-1 shadow-desk-pop"
              >
                {ORDERS.map((o) => (
                  <Menu.Item
                    key={o}
                    onSelect={() => setOrder(o)}
                    className="t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised"
                  >
                    <Icon
                      as={Check}
                      px={14}
                      className={o === order ? "text-desk-ink" : "opacity-0"}
                    />
                    <span className="flex-1">{translate(`files.order.${o}`)}</span>
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}

      <div
        className={`mt-2 overflow-hidden rounded-lg border bg-desk-surface ${above ? "border-2 border-dashed border-desk-accent bg-desk-accent-soft" : ""}`}
      >
        {above ? (
          <div className="t-body p-10 text-center text-desk-accent-soft-ink">
            {translate("files.dropHere", { folder: folder.split("/").pop() ?? "" })}
          </div>
        ) : shown.length === 0 && query ? (
          // Pusty wynik zawężenia to CO INNEGO niż pusty katalog — podpowiedź „przeciągnij
          // tu pliki" byłaby wtedy odpowiedzią na pytanie, którego nikt nie zadał.
          <div className="p-10 text-center">
            <p className="t-body">{translate("files.noMatch", { query: query.trim() })}</p>
            <button
              onClick={() => setQuery("")}
              className="t-meta mt-1 underline hover:text-desk-ink"
            >
              {translate("files.clearFilter")}
            </button>
          </div>
        ) : files.length === 0 && !newFolder ? (
          <div className="p-10 text-center">
            <Icon as={Inbox} px={24} className="mx-auto text-desk-muted-2" />
            <p className="t-body mt-2">{translate("files.empty")}</p>
            <p className="t-meta">{translate("files.emptyHint")}</p>
          </div>
        ) : (
          <ul aria-label={translate("files.inFolder")} className="divide-y">
            {newFolder && (
              <li className="flex h-desk-row items-center gap-2 px-3">
                <span className="grid w-7 shrink-0 place-items-center text-desk-muted">
                  <Icon as={FolderPlus} px={16} />
                </span>
                <input
                  autoFocus
                  placeholder={translate("files.folderName")}
                  aria-label={translate("files.newFolderName")}
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") setNewFolder(false)
                    if (e.key !== "Enter") return
                    const n = (e.target as HTMLInputElement).value.trim()
                    if (!n) {
                      setNewFolder(false)
                      return
                    }
                    await action({ action: "folder", path: `${folder}/${n}` })
                    setNewFolder(false)
                  }}
                  onBlur={() => setNewFolder(false)}
                  className="t-body min-w-0 flex-1 rounded-sm border bg-desk-bg px-1.5 py-0.5 outline-none"
                />
              </li>
            )}
            {shown.map((p) => (
              <FileRow
                key={p.path}
                p={p}
                {...(origins[p.path] ? { origin: origins[p.path]! } : {})}
                picked={picked.includes(p.path)}
                picking={picked.length > 0}
                pick={pick}
                actions={{
                  openFolder: (x) => goTo(x.path),
                  preview: setPreview,
                  download: (x) => window.open(fileUrl(x, true), "_blank"),
                  rename,
                  move: (x) => setToMove([x]),
                  remove,
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowTrash((k) => !k)}
          className="t-meta flex items-center gap-1.5 hover:text-desk-ink"
        >
          <Icon as={Trash2} px={14} />
          {translate("files.trash")} {trash.length > 0 && `(${trash.length})`}
          <Icon as={ChevronDown} px={12} className={showTrash ? "rotate-180" : ""} />
        </button>
        {showTrash && (
          <div className="mt-2 rounded-lg border bg-desk-surface p-3">
            {trash.length === 0 ? (
              <p className="t-meta">{translate("files.trashEmpty")}</p>
            ) : (
              <ul className="space-y-1.5">
                {trash.map((k) => (
                  <li key={k.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="t-body block truncate">{k.name}</span>
                      <span className="t-micro block">
                        {translate("files.fromFolder", { folder: k.from })} · {when(k.when, locale)}
                      </span>
                    </span>
                    <button
                      onClick={async () => {
                        const d = await action({ action: "restore", id: k.id })
                        if (d.landedElsewhere) {
                          toast({
                            text: translate("files.folderGone", { folder: d.originalFolder }),
                          })
                        }
                      }}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 text-[12px] hover:bg-desk-raised"
                    >
                      <Icon as={RotateCcw} px={12} /> {translate("files.restore")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="t-micro pt-2">{translate("files.trashHint")}</p>
          </div>
        )}
      </div>

      <MoveDialog
        files={toMove}
        close={() => setToMove([])}
        move={async (target: string) => {
          const chosen = toMove
          setToMove([])
          if (chosen.length === 0) return
          let moved = 0
          let clash: string | null = null
          for (const p of chosen) {
            const d = await action({ action: "move", from: p.path, to: `${target}/${p.name}` })
            if (d.ok) moved++
            else if (d.error === "name-clash") clash = p.name
          }
          setPicked([])
          const folder = target.split("/").pop() ?? ""
          // Kolizję nazwy mówimy zawsze, nawet gdy reszta przeszła: plik, który został
          // na miejscu, jest ważniejszą wiadomością niż dziewięć, które doszły.
          if (clash) toast({ text: translate("files.alreadyHere", { name: clash }), tone: "error" })
          else if (moved === 0) toast({ text: translate("files.moveFailed"), tone: "error" })
          if (moved > 0) toast({ text: translate("files.moved", { folder }) })
        }}
      />

      <Dialog.Root open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-desk-ink/25" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(820px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-desk-surface shadow-desk-window">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <Dialog.Title className="t-h3 min-w-0 flex-1 truncate">{preview?.name}</Dialog.Title>
              {preview && (
                <a
                  href={fileUrl(preview, true)}
                  className="t-btn rounded-sm px-2 py-1 text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
                >
                  {translate("files.download")}
                </a>
              )}
              <Dialog.Close
                aria-label={translate("files.closePreview")}
                className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
              >
                <Icon as={X} px={16} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {preview && <Preview file={preview} />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
