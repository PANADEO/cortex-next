"use client"
import type { FileMeta } from "@cortex/desk-core/types"
import { FileQuestion } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../routes"
import { Icon } from "./icon"
import { Markdown } from "./markdown"

const MAX_ROWS = 50

function url(p: FileMeta, download = false) {
  return `${api("/file")}?path=${encodeURIComponent(p.path)}${download ? "&download=1" : ""}`
}
export const fileUrl = url

/** Podgląd na ekranie dla formatów, które agent faktycznie wytwarza. Reszta idzie do pobrania. */
export function Preview({ file }: { file: FileMeta }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const isText = ["md", "csv", "txt", "json", "log", "tsv"].includes(ext)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isText) return
    setText(null)
    setError(false)
    let alive = true
    fetch(url(file), { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setText(t))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [file.path, isText])

  if (/^(png|jpe?g|gif|webp|svg)$/.test(ext))
    return <img src={url(file)} alt={file.name} className="max-w-full rounded-md border" />

  if (ext === "pdf")
    return (
      <iframe src={url(file)} title={file.name} className="h-[70vh] w-full rounded-md border" />
    )

  if (!isText)
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Icon as={FileQuestion} px={24} className="mx-auto text-cichy-2" />
        <p className="t-tresc mt-2">Tego pliku nie umiem pokazać na ekranie.</p>
        <p className="t-meta">Pobierz go, żeby otworzyć w swoim programie.</p>
      </div>
    )

  if (error) return <p className="t-meta">Nie udało się wczytać treści pliku.</p>
  if (text === null) return <p className="t-meta">Wczytuję…</p>

  if (ext === "md") return <Markdown text={text} />

  if (ext === "csv" || ext === "tsv") {
    const sep = ext === "tsv" ? "\t" : ","
    const rows = text.trim().split("\n")
    const visible = rows.slice(0, MAX_ROWS + 1)
    const [head, ...rest] = visible
    return (
      <div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead>
              <tr>
                {head?.split(sep).map((c, i) => (
                  <th
                    key={i}
                    className="border-b bg-raised/60 px-2.5 py-1.5 text-left text-[12px] font-semibold text-cichy"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((w, i) => (
                <tr key={i}>
                  {w.split(sep).map((c, j) => (
                    <td key={j} className="border-b px-2.5 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > MAX_ROWS + 1 && (
          <p className="t-micro pt-1.5">
            pokazuję {MAX_ROWS} z {rows.length - 1} wierszy
          </p>
        )}
      </div>
    )
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-sunken p-3 font-mono text-[13px] leading-5">
      {text}
    </pre>
  )
}
