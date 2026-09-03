"use client"
import { LoaderCircle, X } from "lucide-react"
import { useDeskT } from "../i18n/client"
import { fileIcon } from "./file-row"
import { Icon } from "./icon"

export type Attachment = {
  name: string
  preview?: string | undefined
  uploading?: boolean | undefined
}

function kind(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? ""
  return ext.length <= 4 ? ext : "FILE"
}

const isImageFile = (n: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n)

/**
 * Kafelek załącznika — obraz pokazuje miniaturę, reszta ikonę i rodzaj.
 * Nazwa pliku sama w sobie nic nie mówi; człowiek rozpoznaje swój plik po tym, jak wygląda.
 */
export function AttachmentChip({
  z,
  remove,
  open,
}: {
  z: Attachment
  remove?: (() => void) | undefined
  open?: (() => void) | undefined
}) {
  const translate = useDeskT()
  const isImage = isImageFile(z.name) && z.preview
  const Body = (
    <>
      {isImage ? (
        <img src={z.preview} alt="" className="h-11 w-11 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-desk-raised text-desk-muted">
          <Icon as={fileIcon({ name: z.name, folder: false })} px={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 break-all text-left text-[12px] leading-4">{z.name}</span>
        <span className="w-fit rounded-xs bg-desk-raised px-1 text-[10px] uppercase leading-4 text-desk-muted">
          {kind(z.name)}
        </span>
      </span>
    </>
  )

  return (
    <span className="group/chip relative inline-flex max-w-[210px] items-center gap-2 rounded-md border bg-desk-surface p-1.5">
      {open ? (
        <button onClick={open} className="flex min-w-0 items-center gap-2 text-left">
          {Body}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{Body}</span>
      )}

      {z.uploading && (
        <span className="absolute inset-0 grid place-items-center rounded-md bg-desk-surface/75">
          <Icon as={LoaderCircle} px={16} className="spin text-desk-muted" />
        </span>
      )}

      {remove && !z.uploading && (
        // KRZYŻYK STOI ZAWSZE. Do 03.09.2026 pojawiał się dopiero pod myszą, więc dołączony
        // przez pomyłkę plik nie miał widocznej drogi odwrotu — a to jest ta jedna chwila,
        // w której człowiek najbardziej potrzebuje zobaczyć, że da się cofnąć.
        // Krzyżyk zostaje bez podpisu, bo nie jest ikoną-zagadką: to znana forma domknięcia
        // przypiętego do NAZWANEJ rzeczy (karta w przeglądarce, załącznik w poczcie),
        // a nazwa pliku stoi tuż obok. Słowo „Usuń" na kaflu o szerokości 210 px
        // wypchnęłoby tę nazwę, czyli zabrałoby jedyną informację, która tu jest treścią.
        <button
          onClick={remove}
          aria-label={translate("attachments.remove", { name: z.name })}
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-desk-pill border bg-desk-surface text-desk-muted shadow-desk-pop transition hover:text-desk-ink"
        >
          <Icon as={X} px={12} />
        </button>
      )}
    </span>
  )
}

export function AttachmentList({
  files,
  remove,
  open,
  className,
}: {
  files: Attachment[]
  remove?: ((n: string) => void) | undefined
  open?: ((n: string) => void) | undefined
  className?: string | undefined
}) {
  if (!files.length) return null
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {files.map((z) => (
        <AttachmentChip
          key={z.name}
          z={z}
          remove={remove ? () => remove(z.name) : undefined}
          open={open ? () => open(z.name) : undefined}
        />
      ))}
    </div>
  )
}
