"use client"
import type { FileMeta } from "@cortex/desk-core/types"
import { Download, Maximize2 } from "lucide-react"
import { useDeskT } from "../i18n/client"
import { size } from "../lib"
import { fileIcon } from "./file-row"
import { Icon } from "./icon"
import { fileUrl } from "./preview"

const isImageFile = (n: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n)
const kind = (n: string) => (n.split(".").pop() ?? "").toUpperCase()

/**
 * To, co powstało w tej turze, pokazujemy W ROZMOWIE, a nie tylko w panelu z boku.
 *
 * Obrazek bez podglądu to sama nazwa pliku — a nazwa nie mówi, czy słoń wyszedł dobrze.
 * Dokument dostaje kartę zamiast obrazu, bo jego treść i tak nie zmieści się w strumieniu;
 * karta ma powiedzieć, że rzecz istnieje, i wpuścić do panelu jednym kliknięciem.
 */
export function Artifacts({ files, open }: { files: FileMeta[]; open: (p: FileMeta) => void }) {
  if (!files.length) return null
  return (
    <div className="flex flex-col gap-3">
      {files.map((p) =>
        isImageFile(p.name) ? (
          <ImageBlock key={p.path} file={p} open={() => open(p)} />
        ) : (
          <Card key={p.path} file={p} open={() => open(p)} />
        ),
      )}
    </div>
  )
}

function ImageBlock({ file, open }: { file: FileMeta; open: () => void }) {
  const translate = useDeskT()
  return (
    <figure className="max-w-[420px]">
      <button
        onClick={open}
        title={translate("artifacts.openInPanel")}
        aria-label={translate("artifacts.open", { name: file.name })}
        className="block w-full overflow-hidden rounded-lg border bg-desk-surface transition hover:border-desk-line-strong"
      >
        <img
          src={fileUrl(file)}
          alt={file.name}
          className="block max-h-[420px] w-full bg-desk-sunken object-contain"
        />
      </button>
      <figcaption className="flex items-center gap-2 px-0.5 pt-1.5">
        <span className="t-meta min-w-0 flex-1 truncate">{file.name}</span>
        <a
          href={fileUrl(file, true)}
          download
          title={translate("files.download")}
          aria-label={translate("artifacts.download", { name: file.name })}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
        >
          <Icon as={Download} px={14} />
        </a>
      </figcaption>
    </figure>
  )
}

function Card({ file, open }: { file: FileMeta; open: () => void }) {
  const translate = useDeskT()
  return (
    <button
      onClick={open}
      aria-label={translate("artifacts.open", { name: file.name })}
      className="group/cardFor flex w-full max-w-[420px] items-center gap-3 rounded-lg border bg-desk-surface p-2.5 text-left transition hover:border-desk-line-strong hover:bg-desk-raised/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-desk-raised text-desk-muted">
        <Icon as={fileIcon(file)} px={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-body-m block truncate">{file.name}</span>
        <span className="t-meta block">
          {translate("artifacts.document")} · {kind(file.name)} · {size(file.size)}
        </span>
      </span>
      <Icon
        as={Maximize2}
        px={16}
        className="shrink-0 text-desk-muted-2 group-hover/cardFor:text-desk-ink"
      />
    </button>
  )
}
