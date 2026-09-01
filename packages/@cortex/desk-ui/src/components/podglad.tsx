"use client"
import type { PlikMeta } from "@cortex/desk-core/typy"
import { FileQuestion } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../trasy"
import { Ikona } from "./ikona"
import { Md } from "./md"

const MAX_WIERSZY = 50

function url(p: PlikMeta, pobierz = false) {
  return `${api("/plik")}?sciezka=${encodeURIComponent(p.sciezka)}${pobierz ? "&pobierz=1" : ""}`
}
export const adresPliku = url

/** Podgląd na ekranie dla formatów, które agent faktycznie wytwarza. Reszta idzie do pobrania. */
export function Podglad({ plik }: { plik: PlikMeta }) {
  const ext = plik.nazwa.split(".").pop()?.toLowerCase() ?? ""
  const tekstowy = ["md", "csv", "txt", "json", "log", "tsv"].includes(ext)
  const [tresc, setTresc] = useState<string | null>(null)
  const [blad, setBlad] = useState(false)

  useEffect(() => {
    if (!tekstowy) return
    setTresc(null)
    setBlad(false)
    let zyje = true
    fetch(url(plik), { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => zyje && setTresc(t))
      .catch(() => zyje && setBlad(true))
    return () => {
      zyje = false
    }
  }, [plik.sciezka, tekstowy])

  if (/^(png|jpe?g|gif|webp|svg)$/.test(ext))
    return <img src={url(plik)} alt={plik.nazwa} className="max-w-full rounded-md border" />

  if (ext === "pdf")
    return (
      <iframe src={url(plik)} title={plik.nazwa} className="h-[70vh] w-full rounded-md border" />
    )

  if (!tekstowy)
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Ikona jako={FileQuestion} px={24} klasa="mx-auto text-cichy-2" />
        <p className="t-tresc mt-2">Tego pliku nie umiem pokazać na ekranie.</p>
        <p className="t-meta">Pobierz go, żeby otworzyć w swoim programie.</p>
      </div>
    )

  if (blad) return <p className="t-meta">Nie udało się wczytać treści pliku.</p>
  if (tresc === null) return <p className="t-meta">Wczytuję…</p>

  if (ext === "md") return <Md tekst={tresc} />

  if (ext === "csv" || ext === "tsv") {
    const sep = ext === "tsv" ? "\t" : ","
    const wiersze = tresc.trim().split("\n")
    const widoczne = wiersze.slice(0, MAX_WIERSZY + 1)
    const [glowa, ...reszta] = widoczne
    return (
      <div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead>
              <tr>
                {glowa?.split(sep).map((c, i) => (
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
              {reszta.map((w, i) => (
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
        {wiersze.length > MAX_WIERSZY + 1 && (
          <p className="t-micro pt-1.5">
            pokazuję {MAX_WIERSZY} z {wiersze.length - 1} wierszy
          </p>
        )}
      </div>
    )
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-sunken p-3 font-mono text-[13px] leading-5">
      {tresc}
    </pre>
  )
}
