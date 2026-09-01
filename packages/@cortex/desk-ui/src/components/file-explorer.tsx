"use client"
import type { FileMeta } from "@cortex/desk-core/types"
import * as Dialog from "@radix-ui/react-dialog"
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { count, when } from "../lib"
import { api, t } from "../routes"
import { FileRow } from "./file-row"
import { Icon } from "./icon"
import { MoveDialog } from "./move-dialog"
import { Preview, fileUrl } from "./preview"
import { useToast } from "./toast"

type TrashEntry = { id: string; name: string; from: string; when: string }
const ROOT = "Moje pliki"

export function FileExplorer() {
  const router = useRouter()
  const params = useSearchParams()
  const folder = params.get("k") ?? ROOT
  const { toast } = useToast()

  const [files, setFiles] = useState<FileMeta[]>([])
  const [trash, setTrash] = useState<TrashEntry[]>([])
  const [showTrash, setShowTrash] = useState(false)
  const [taken, setTaken] = useState(false)
  const [above, setAbove] = useState(false)
  const [toMove, setToMove] = useState<FileMeta | null>(null)
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
    setTrash(d.trash ?? [])
  }, [folder])

  useEffect(() => {
    refresh()
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
        text: `${tooLarge[0]!.name} waży więcej niż 25 MB — tyle nie przyjmę.`,
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
        ? { text: `Dodane: ${count(files.length, "plik", "pliki", "plików")}` }
        : { text: "Nie udało się wgrać plików.", tone: "error" },
    )
  }

  async function remove(p: FileMeta) {
    const d = await action({ action: "trash", path: p.path })
    if (!d.ok) {
      toast({ text: `Nie udało się usunąć ${p.name}.`, tone: "error" })
      return
    }
    toast({
      text: `Przeniesione do kosza: ${p.name}`,
      revoke: async () => {
        const w = await action({ action: "restore", id: d.id })
        if (!w.ok) toast({ text: "Nie udało się cofnąć.", tone: "error" })
      },
    })
  }

  async function rename(p: FileMeta, nextName: string): Promise<string | null> {
    const d = await action({ action: "move", from: p.path, to: `${folder}/${nextName}` })
    if (d.ok) return null
    return d.error === "kolizja"
      ? "Taki plik już tu jest. Wybierz inną nazwę."
      : "Nie udało się zmienić nazwy."
  }

  const breadcrumbs = ["Biurko", ...folder.split("/")]
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
      <h1 className="t-display">Moje pliki</h1>
      <p className="t-body mt-1 text-desk-muted">
        Tu trzymasz to, na czym pracujesz. Pliki zostają na biurku — nie znikają razem ze sprawą.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input ref={picker} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button
          onClick={() => picker.current?.click()}
          disabled={taken}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md bg-desk-accent px-3.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-50"
        >
          <Icon as={Upload} px={16} /> {taken ? "Wgrywam…" : "Dodaj pliki"}
        </button>
        <button
          onClick={() => setNewFolder(true)}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md border px-3.5 hover:bg-desk-raised"
        >
          <Icon as={FolderPlus} px={16} /> Nowy folder
        </button>
      </div>

      <nav aria-label="Ścieżka" className="t-meta mt-4 flex flex-wrap items-center gap-0.5">
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

      <div
        className={`mt-2 overflow-hidden rounded-lg border bg-desk-surface ${above ? "border-2 border-dashed border-desk-accent bg-desk-accent-soft" : ""}`}
      >
        {above ? (
          <div className="t-body p-10 text-center text-desk-accent-soft-ink">
            Upuść pliki tutaj — trafią do: {folder.split("/").pop()}
          </div>
        ) : files.length === 0 && !newFolder ? (
          <div className="p-10 text-center">
            <Icon as={Inbox} px={24} className="mx-auto text-desk-muted-2" />
            <p className="t-body mt-2">Tu jeszcze nic nie ma</p>
            <p className="t-meta">Przeciągnij pliki albo kliknij „Dodaj pliki”.</p>
          </div>
        ) : (
          <ul aria-label="Pliki w tym folderze" className="divide-y">
            {newFolder && (
              <li className="flex h-desk-row items-center gap-2 px-3">
                <span className="grid w-7 shrink-0 place-items-center text-desk-muted">
                  <Icon as={FolderPlus} px={16} />
                </span>
                <input
                  autoFocus
                  placeholder="Nazwa folderu"
                  aria-label="Nazwa nowego folderu"
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
            {files.map((p) => (
              <FileRow
                key={p.path}
                p={p}
                actions={{
                  openFolder: (x) => goTo(x.path),
                  preview: setPreview,
                  download: (x) => window.open(fileUrl(x, true), "_blank"),
                  rename,
                  move: setToMove,
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
          Kosz {trash.length > 0 && `(${trash.length})`}
          <Icon as={ChevronDown} px={12} className={showTrash ? "rotate-180" : ""} />
        </button>
        {showTrash && (
          <div className="mt-2 rounded-lg border bg-desk-surface p-3">
            {trash.length === 0 ? (
              <p className="t-meta">Kosz jest pusty.</p>
            ) : (
              <ul className="space-y-1.5">
                {trash.map((k) => (
                  <li key={k.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="t-body block truncate">{k.name}</span>
                      <span className="t-micro block">
                        z {k.from} · {when(k.when)}
                      </span>
                    </span>
                    <button
                      onClick={async () => {
                        const d = await action({ action: "restore", id: k.id })
                        if (d.landedElsewhere) {
                          toast({
                            text: `Folder ${d.pierwotny} już nie istnieje — plik wrócił do Moich plików.`,
                          })
                        }
                      }}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 text-[12px] hover:bg-desk-raised"
                    >
                      <Icon as={RotateCcw} px={12} /> Przywróć
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="t-micro pt-2">
              Skasowane pliki zostają tutaj, dopóki ich stąd nie zabierzesz.
            </p>
          </div>
        )}
      </div>

      <MoveDialog
        file={toMove}
        close={() => setToMove(null)}
        move={async (target: string) => {
          const p = toMove
          if (!p) return
          const d = await action({ action: "move", from: p.path, to: `${target}/${p.name}` })
          setToMove(null)
          if (d.ok) toast({ text: `Przeniesione do: ${target.split("/").pop()}` })
          else if (d.error === "kolizja")
            toast({ text: `${p.name} już jest w tym folderze.`, tone: "error" })
          else toast({ text: "Nie udało się przenieść pliku.", tone: "error" })
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
                  Pobierz
                </a>
              )}
              <Dialog.Close
                aria-label="Zamknij podgląd"
                className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
              >
                <Icon as={X} px={16} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {preview && <Preview file={preview} />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
