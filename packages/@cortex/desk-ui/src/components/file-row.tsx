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
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { size, when } from "../lib"
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
}: {
  p: FileMeta
  actions: FileActions
  active?: boolean
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
        className="group flex h-desk-row items-center gap-2 px-3 hover:bg-desk-raised/60"
      >
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

        <span className="t-meta hidden shrink-0 sm:block">{p.folder ? "" : size(p.size)}</span>
        <span className="t-meta hidden w-24 shrink-0 text-right sm:block">
          {when(p.modifiedAt, locale)}
        </span>

        <Menu.Root>
          <Menu.Trigger
            aria-label={translate("fileRow.more", { name: p.name })}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-desk-muted opacity-0 hover:bg-desk-raised focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
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

function MenuItem({
  icon,
  label,
  shortcut,
  na,
  dangerous,
}: {
  icon: LucideIcon
  label: string
  shortcut?: string
  na: () => void
  dangerous?: boolean
}) {
  return (
    <Menu.Item
      onSelect={na}
      className={`t-body flex cursor-pointer items-center gap-2.5 px-3 py-1.5 outline-none data-[highlighted]:bg-desk-raised ${dangerous ? "text-desk-bad" : ""}`}
    >
      <Icon as={icon} px={16} className={dangerous ? undefined : "text-desk-muted"} />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="t-micro">{shortcut}</span>}
    </Menu.Item>
  )
}
