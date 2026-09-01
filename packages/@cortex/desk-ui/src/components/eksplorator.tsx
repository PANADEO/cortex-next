"use client"
import type { PlikMeta } from "@cortex/desk-core/typy"
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
import { ile, kiedy } from "../lib"
import { api } from "../trasy"
import { DialogPrzenies } from "./dialog-przenies"
import { Ikona } from "./ikona"
import { Podglad, adresPliku } from "./podglad"
import { useToast } from "./toast"
import { WierszPliku } from "./wiersz-pliku"

type Kosz = { id: string; nazwa: string; skad: string; kiedy: string }
const KORZEN = "Moje pliki"

export function Eksplorator() {
  const router = useRouter()
  const params = useSearchParams()
  const katalog = params.get("k") ?? KORZEN
  const { pokaz } = useToast()

  const [pliki, setPliki] = useState<PlikMeta[]>([])
  const [kosz, setKosz] = useState<Kosz[]>([])
  const [pokazKosz, setPokazKosz] = useState(false)
  const [zajete, setZajete] = useState(false)
  const [nadNami, setNadNami] = useState(false)
  const [doPrzeniesienia, setDoPrzeniesienia] = useState<PlikMeta | null>(null)
  const [podglad, setPodglad] = useState<PlikMeta | null>(null)
  const [nowyFolder, setNowyFolder] = useState(false)
  const licznik = useRef(0)
  const wybor = useRef<HTMLInputElement>(null)

  const odswiez = useCallback(async () => {
    const r = await fetch(`${api("")}/pliki?katalog=${encodeURIComponent(katalog)}`, {
      cache: "no-store",
    })
    const d = await r.json()
    setPliki(d.pliki ?? [])
    setKosz(d.kosz ?? [])
  }, [katalog])

  useEffect(() => {
    odswiez()
  }, [odswiez])

  const idzDo = (k: string) =>
    router.push(k === KORZEN ? "/pliki" : `/pliki?k=${encodeURIComponent(k)}`)

  async function akcja(body: Record<string, unknown>) {
    const r = await fetch(api("/pliki"), { method: "POST", body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    await odswiez()
    return { ok: r.ok, status: r.status, ...d }
  }

  async function wgraj(files: FileList | null) {
    if (!files?.length) return
    const zaDuze = Array.from(files).filter((f) => f.size > 25 * 1024 * 1024)
    if (zaDuze.length) {
      pokaz({ tekst: `${zaDuze[0]!.name} waży więcej niż 25 MB — tyle nie przyjmę.`, ton: "blad" })
      return
    }
    setZajete(true)
    const fd = new FormData()
    fd.append("katalog", katalog)
    Array.from(files).forEach((f) => fd.append("plik", f))
    const r = await fetch(api("/pliki/wgraj"), { method: "POST", body: fd })
    setZajete(false)
    await odswiez()
    pokaz(
      r.ok
        ? { tekst: `Dodane: ${ile(files.length, "plik", "pliki", "plików")}` }
        : { tekst: "Nie udało się wgrać plików.", ton: "blad" },
    )
  }

  async function usun(p: PlikMeta) {
    const d = await akcja({ akcja: "kosz", sciezka: p.sciezka })
    if (!d.ok) {
      pokaz({ tekst: `Nie udało się usunąć ${p.nazwa}.`, ton: "blad" })
      return
    }
    pokaz({
      tekst: `Przeniesione do kosza: ${p.nazwa}`,
      cofnij: async () => {
        const w = await akcja({ akcja: "przywroc", id: d.id })
        if (!w.ok) pokaz({ tekst: "Nie udało się cofnąć.", ton: "blad" })
      },
    })
  }

  async function zmienNazwe(p: PlikMeta, nowa: string): Promise<string | null> {
    const d = await akcja({ akcja: "przenies", z: p.sciezka, do: `${katalog}/${nowa}` })
    if (d.ok) return null
    return d.blad === "kolizja"
      ? "Taki plik już tu jest. Wybierz inną nazwę."
      : "Nie udało się zmienić nazwy."
  }

  const okruchy = ["Biurko", ...katalog.split("/")]
  const sciezki = katalog.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"))

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        licznik.current++
        setNadNami(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        licznik.current--
        if (licznik.current <= 0) setNadNami(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        licznik.current = 0
        setNadNami(false)
        wgraj(e.dataTransfer.files)
      }}
      className="mx-auto max-w-strumien px-5 py-8 pb-24 md:pb-8"
    >
      <h1 className="t-display">Moje pliki</h1>
      <p className="t-tresc mt-1 text-cichy">
        Tu trzymasz to, na czym pracujesz. Pliki zostają na biurku — nie znikają razem ze sprawą.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input ref={wybor} type="file" multiple hidden onChange={(e) => wgraj(e.target.files)} />
        <button
          onClick={() => wybor.current?.click()}
          disabled={zajete}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md bg-akcent px-3.5 text-akcent-ink hover:bg-akcent-hover disabled:opacity-50"
        >
          <Ikona jako={Upload} px={16} /> {zajete ? "Wgrywam…" : "Dodaj pliki"}
        </button>
        <button
          onClick={() => setNowyFolder(true)}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md border px-3.5 hover:bg-raised"
        >
          <Ikona jako={FolderPlus} px={16} /> Nowy folder
        </button>
      </div>

      <nav aria-label="Ścieżka" className="t-meta mt-4 flex flex-wrap items-center gap-0.5">
        {okruchy.map((o, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <Ikona jako={ChevronRight} px={12} klasa="text-cichy-2" />}
            {i === 0 ? (
              <span className="text-cichy-2">{o}</span>
            ) : i === okruchy.length - 1 ? (
              <span className="font-medium text-ink">{o}</span>
            ) : (
              <button
                onClick={() => idzDo(sciezki[i - 1] ?? "")}
                className="rounded-sm px-1 hover:bg-raised hover:text-ink"
              >
                {o}
              </button>
            )}
          </span>
        ))}
      </nav>

      <div
        className={`mt-2 overflow-hidden rounded-lg border bg-surface ${nadNami ? "border-2 border-dashed border-akcent bg-akcent-soft" : ""}`}
      >
        {nadNami ? (
          <div className="t-tresc p-10 text-center text-akcent-soft-ink">
            Upuść pliki tutaj — trafią do: {katalog.split("/").pop()}
          </div>
        ) : pliki.length === 0 && !nowyFolder ? (
          <div className="p-10 text-center">
            <Ikona jako={Inbox} px={24} klasa="mx-auto text-cichy-2" />
            <p className="t-tresc mt-2">Tu jeszcze nic nie ma</p>
            <p className="t-meta">Przeciągnij pliki albo kliknij „Dodaj pliki”.</p>
          </div>
        ) : (
          <ul aria-label="Pliki w tym folderze" className="divide-y">
            {nowyFolder && (
              <li className="flex h-wiersz items-center gap-2 px-3">
                <span className="grid w-7 shrink-0 place-items-center text-cichy">
                  <Ikona jako={FolderPlus} px={16} />
                </span>
                <input
                  autoFocus
                  placeholder="Nazwa folderu"
                  aria-label="Nazwa nowego folderu"
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") setNowyFolder(false)
                    if (e.key !== "Enter") return
                    const n = (e.target as HTMLInputElement).value.trim()
                    if (!n) {
                      setNowyFolder(false)
                      return
                    }
                    await akcja({ akcja: "katalog", sciezka: `${katalog}/${n}` })
                    setNowyFolder(false)
                  }}
                  onBlur={() => setNowyFolder(false)}
                  className="t-tresc min-w-0 flex-1 rounded-sm border bg-bg px-1.5 py-0.5 outline-none"
                />
              </li>
            )}
            {pliki.map((p) => (
              <WierszPliku
                key={p.sciezka}
                p={p}
                akcje={{
                  otworzKatalog: (x) => idzDo(x.sciezka),
                  podglad: setPodglad,
                  pobierz: (x) => window.open(adresPliku(x, true), "_blank"),
                  zmienNazwe,
                  przenies: setDoPrzeniesienia,
                  usun,
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={() => setPokazKosz((k) => !k)}
          className="t-meta flex items-center gap-1.5 hover:text-ink"
        >
          <Ikona jako={Trash2} px={14} />
          Kosz {kosz.length > 0 && `(${kosz.length})`}
          <Ikona jako={ChevronDown} px={12} klasa={pokazKosz ? "rotate-180" : ""} />
        </button>
        {pokazKosz && (
          <div className="mt-2 rounded-lg border bg-surface p-3">
            {kosz.length === 0 ? (
              <p className="t-meta">Kosz jest pusty.</p>
            ) : (
              <ul className="space-y-1.5">
                {kosz.map((k) => (
                  <li key={k.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="t-tresc block truncate">{k.nazwa}</span>
                      <span className="t-micro block">
                        z {k.skad} · {kiedy(k.kiedy)}
                      </span>
                    </span>
                    <button
                      onClick={async () => {
                        const d = await akcja({ akcja: "przywroc", id: k.id })
                        if (d.wrociloGdzieIndziej) {
                          pokaz({
                            tekst: `Folder ${d.pierwotny} już nie istnieje — plik wrócił do Moich plików.`,
                          })
                        }
                      }}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2 text-[12px] hover:bg-raised"
                    >
                      <Ikona jako={RotateCcw} px={12} /> Przywróć
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

      <DialogPrzenies
        plik={doPrzeniesienia}
        zamknij={() => setDoPrzeniesienia(null)}
        przenies={async (docelowy) => {
          const p = doPrzeniesienia
          if (!p) return
          const d = await akcja({ akcja: "przenies", z: p.sciezka, do: `${docelowy}/${p.nazwa}` })
          setDoPrzeniesienia(null)
          if (d.ok) pokaz({ tekst: `Przeniesione do: ${docelowy.split("/").pop()}` })
          else if (d.blad === "kolizja")
            pokaz({ tekst: `${p.nazwa} już jest w tym folderze.`, ton: "blad" })
          else pokaz({ tekst: "Nie udało się przenieść pliku.", ton: "blad" })
        }}
      />

      <Dialog.Root open={Boolean(podglad)} onOpenChange={(o) => !o && setPodglad(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(820px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-surface shadow-okno">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <Dialog.Title className="t-h3 min-w-0 flex-1 truncate">{podglad?.nazwa}</Dialog.Title>
              {podglad && (
                <a
                  href={adresPliku(podglad, true)}
                  className="t-btn rounded-sm px-2 py-1 text-cichy hover:bg-raised hover:text-ink"
                >
                  Pobierz
                </a>
              )}
              <Dialog.Close
                aria-label="Zamknij podgląd"
                className="grid h-8 w-8 place-items-center rounded-sm text-cichy hover:bg-raised"
              >
                <Ikona jako={X} px={16} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {podglad && <Podglad plik={podglad} />}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
