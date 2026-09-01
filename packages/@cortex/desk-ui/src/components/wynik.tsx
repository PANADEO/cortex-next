"use client"
import type { Dowod } from "@cortex/desk-core/dowod"
import type { PlikMeta } from "@cortex/desk-core/typy"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderInput,
  Inbox,
  Paperclip,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"
import { kiedy, rozmiar } from "../lib"
import { api } from "../trasy"
import { Ikona } from "./ikona"
import { Podglad, adresPliku } from "./podglad"
import { useToast } from "./toast"
import { ikonaPliku } from "./wiersz-pliku"

/**
 * Wynik pracy to najważniejszy obiekt w całej aplikacji — dostaje własne miejsce,
 * z którego nie ucieka razem z przewijaniem historii.
 *
 * Wybór pliku trzyma rodzic, bo do panelu wchodzi się nie tylko stąd: także kliknięciem
 * w kartę artefaktu albo w załącznik w rozmowie. Dwa niezależne stany rozjeżdżały się
 * przy pierwszym takim kliknięciu.
 */
export function Wynik({
  wyniki,
  zalaczniki,
  aktywny,
  naWybor,
  dowod,
  doDowodu,
}: {
  wyniki: PlikMeta[]
  zalaczniki: PlikMeta[]
  aktywny: PlikMeta | null
  naWybor: (p: PlikMeta) => void
  dowod: Dowod
  doDowodu?: () => void
}) {
  const { pokaz } = useToast()
  const [skopiowane, setSkopiowane] = useState(false)

  if (!aktywny) {
    return (
      <div className="flex h-full flex-col">
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <Ikona jako={Inbox} px={24} klasa="mx-auto text-cichy-2" />
            <p className="t-tresc mt-2 text-cichy">Tu pojawi się gotowy dokument.</p>
          </div>
        </div>
        <OdCiebie pliki={zalaczniki} aktywny={null} naWybor={naWybor} />
      </div>
    )
  }

  const odCzlowieka = zalaczniki.some((z) => z.sciezka === aktywny.sciezka)

  /**
   * Plakietka mówi wyłącznie to, co widać w zdarzeniach. „Sprawdzony" należy się dopiero wtedy,
   * gdy plik faktycznie odczytano po zapisie; brak sprawdzenia to brak plakietki, nie pochwała.
   * Załącznika człowieka nie oceniamy w ogóle — nikt go tu nie wytworzył.
   */
  const stanPliku: "sprawdzony" | "niesprawdzony" | null = odCzlowieka
    ? null
    : dowod.nieSprawdzone.some((n) => n.includes(aktywny.nazwa))
      ? "niesprawdzony"
      : dowod.zrobione.some((z) => z.startsWith(`odczytano ${aktywny.nazwa} po zapisie`))
        ? "sprawdzony"
        : null

  async function kopiuj() {
    if (!aktywny) return
    try {
      const t = await (await fetch(adresPliku(aktywny), { cache: "no-store" })).text()
      await navigator.clipboard.writeText(t)
      setSkopiowane(true)
      setTimeout(() => setSkopiowane(false), 2000)
    } catch {
      pokaz({ tekst: "Nie udało się skopiować treści.", ton: "blad" })
    }
  }

  async function doMoichPlikow() {
    if (!aktywny) return
    const r = await fetch(api("/pliki"), {
      method: "POST",
      body: JSON.stringify({
        akcja: "kopiuj",
        z: aktywny.sciezka,
        do: `Moje pliki/${aktywny.nazwa}`,
      }),
    })
    const d = await r.json()
    pokaz(
      r.ok
        ? { tekst: `Zapisane w Moich plikach: ${d.gdzie?.split("/").pop() ?? aktywny.nazwa}` }
        : { tekst: "Nie udało się zapisać do Moich plików.", ton: "blad" },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <Ikona jako={ikonaPliku(aktywny)} px={20} klasa="mt-0.5 shrink-0 text-cichy" />
          <div className="min-w-0 flex-1">
            <div className="t-h3 break-words">{aktywny.nazwa}</div>
            <div className="t-meta">
              {odCzlowieka ? "Twój załącznik" : "Dokument"} · {rozmiar(aktywny.rozmiar)} · zapisany{" "}
              {kiedy(aktywny.zmieniony)}
            </div>
          </div>
        </div>
        {stanPliku && (
          <button
            onClick={doDowodu}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[12px] ${
              stanPliku === "niesprawdzony" ? "bg-warn-soft text-warn" : "bg-raised text-cichy"
            }`}
          >
            <Ikona jako={stanPliku === "niesprawdzony" ? TriangleAlert : ShieldCheck} px={12} />
            {stanPliku === "niesprawdzony" ? "niesprawdzony" : "sprawdzony po zapisie"}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <Akcja
          ikona={Download}
          tytul="Pobierz"
          na={() => window.open(adresPliku(aktywny, true), "_blank")}
        />
        <Akcja ikona={FolderInput} tytul="Zapisz do Moich plików" na={doMoichPlikow} />
        <Akcja
          ikona={skopiowane ? Check : Copy}
          tytul={skopiowane ? "Skopiowane" : "Kopiuj treść"}
          na={kopiuj}
        />
      </div>

      {wyniki.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5">
          {wyniki.map((p) => (
            <button
              key={p.sciezka}
              onClick={() => naWybor(p)}
              className={`shrink-0 rounded-sm px-2 py-1 text-[13px] ${
                p.sciezka === aktywny.sciezka
                  ? "bg-raised font-medium"
                  : "text-cichy hover:bg-raised/60"
              }`}
            >
              {p.nazwa}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Podglad plik={aktywny} />
      </div>

      <OdCiebie pliki={zalaczniki} aktywny={aktywny} naWybor={naWybor} />
    </div>
  )
}

/** To, co wniósł człowiek, nie jest wynikiem pracy agenta i nie może się nim podszywać. */
function OdCiebie({
  pliki,
  aktywny,
  naWybor,
}: {
  pliki: PlikMeta[]
  aktywny: PlikMeta | null
  naWybor: (p: PlikMeta) => void
}) {
  const [otwarte, setOtwarte] = useState(false)
  if (!pliki.length) return null
  return (
    <div className="shrink-0 border-t">
      <button
        onClick={() => setOtwarte((o) => !o)}
        className="t-meta flex h-9 w-full items-center gap-1.5 px-4 hover:text-ink"
      >
        <Ikona jako={Paperclip} px={12} />
        Od Ciebie ({pliki.length})
        <Ikona jako={ChevronDown} px={12} klasa={otwarte ? "rotate-180" : ""} />
      </button>
      {otwarte && (
        <ul className="max-h-40 overflow-y-auto px-2 pb-2">
          {pliki.map((p) => (
            <li key={p.sciezka}>
              <button
                onClick={() => naWybor(p)}
                className={`flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-[13px] hover:bg-raised ${
                  p.sciezka === aktywny?.sciezka ? "bg-raised font-medium" : ""
                }`}
              >
                <Ikona jako={ikonaPliku(p)} px={14} klasa="shrink-0 text-cichy" />
                <span className="min-w-0 flex-1 truncate">{p.nazwa}</span>
                <span className="t-micro shrink-0">{rozmiar(p.rozmiar)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Akcja({ ikona, tytul, na }: { ikona: LucideIcon; tytul: string; na: () => void }) {
  return (
    <button
      onClick={na}
      title={tytul}
      aria-label={tytul}
      className="grid h-8 w-8 place-items-center rounded-sm text-cichy hover:bg-raised hover:text-ink"
    >
      <Ikona jako={ikona} px={16} />
    </button>
  )
}
