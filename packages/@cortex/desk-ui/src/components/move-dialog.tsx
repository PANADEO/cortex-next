"use client"
import type { FileMeta } from "@cortex/desk-core/types"
import * as Dialog from "@radix-ui/react-dialog"
import { Check, Folder, FolderPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../routes"
import { Icon } from "./icon"

/** Wybór miejsca z listy — nikt nie ma wpisywać ścieżki „Moje pliki/Wnioski 2026" z pamięci. */
export function MoveDialog({
  file,
  close,
  move,
}: {
  file: FileMeta | null
  close: () => void
  move: (target: string) => Promise<void>
}) {
  const [folders, setFolders] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [newForm, setNewForm] = useState("")
  const [creating, setCreating] = useState(false)
  const [taken, setTaken] = useState(false)

  const current = file ? file.path.split("/").slice(0, -1).join("/") : ""

  useEffect(() => {
    if (!file) return
    setSelected(null)
    setNewForm("")
    setCreating(false)
    fetch(`${api("/files")}?tree=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFolders(d.folders ?? []))
  }, [file])

  async function create() {
    const n = newForm.trim()
    if (!n) return
    const path = `${selected ?? "Moje pliki"}/${n}`
    await fetch(api("/files"), {
      method: "POST",
      body: JSON.stringify({ action: "folder", path }),
    })
    const d = await (await fetch(`${api("/files")}?tree=1`, { cache: "no-store" })).json()
    setFolders(d.folders ?? [])
    setSelected(path)
    setNewForm("")
    setCreating(false)
  }

  return (
    <Dialog.Root open={Boolean(file)} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-desk-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-desk-surface shadow-desk-window">
          <div className="border-b px-4 py-3">
            <Dialog.Title className="t-h3">Przenieś do</Dialog.Title>
            <Dialog.Description className="t-meta">Przenoszę: {file?.name}</Dialog.Description>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {folders.map((k) => {
              const here = k === current
              const isSelected = selected === k
              const level = k.split("/").length - 1
              return (
                <li key={k}>
                  <button
                    disabled={here}
                    onClick={() => setSelected(k)}
                    style={{ paddingLeft: 8 + level * 16 }}
                    className={`t-body flex h-9 w-full items-center gap-2 rounded-sm pr-2 text-left disabled:opacity-45 ${selected ? "bg-desk-raised" : "hover:bg-desk-raised/60"}`}
                  >
                    <Icon as={Folder} px={16} className="shrink-0 text-desk-muted" />
                    <span className="min-w-0 flex-1 truncate">{k.split("/").pop()}</span>
                    {here && <span className="t-micro shrink-0">plik już tu jest</span>}
                    {isSelected && (
                      <Icon as={Check} px={16} className="shrink-0 text-desk-accent" />
                    )}
                  </button>
                </li>
              )
            })}
            <li>
              {creating ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <Icon as={Folder} px={16} className="shrink-0 text-desk-muted" />
                  <input
                    autoFocus
                    value={newForm}
                    onChange={(e) => setNewForm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void create()
                      if (e.key === "Escape") setCreating(false)
                    }}
                    placeholder="Nazwa folderu"
                    aria-label="Nazwa nowego folderu"
                    className="t-body min-w-0 flex-1 rounded-sm border bg-desk-bg px-1.5 py-1 outline-none"
                  />
                  <button
                    onClick={() => void create()}
                    className="t-btn rounded-sm px-2 py-1 text-desk-accent hover:bg-desk-raised"
                  >
                    Utwórz
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="t-body flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-desk-muted hover:bg-desk-raised/60"
                >
                  <Icon as={FolderPlus} px={16} className="shrink-0" />
                  Nowy folder tutaj
                </button>
              )}
            </li>
          </ul>

          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <Dialog.Close className="t-btn rounded-md border px-3 py-1.5 hover:bg-desk-raised">
              Anuluj
            </Dialog.Close>
            <button
              disabled={!selected || taken}
              onClick={async () => {
                if (!selected) return
                setTaken(true)
                await move(selected)
                setTaken(false)
              }}
              className="t-btn rounded-md bg-desk-accent px-3 py-1.5 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-40"
            >
              Przenieś
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
