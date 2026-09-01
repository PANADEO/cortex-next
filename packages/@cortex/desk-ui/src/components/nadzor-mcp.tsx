"use client"
import type { Zdolnosc } from "@cortex/desk-core/typy"
import { Globe, Plus, RefreshCw, ShieldAlert, TriangleAlert, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { api } from "../trasy"
import { Ikona } from "./ikona"
import { useToast } from "./toast"

type Narzedzie = {
  serwer: string
  nazwaZdalna: string
  opis: string
  krotko: string
  zdolnoscId: string
  odcisk: string
  stan: "zatwierdzone" | "wstrzymane"
  powod: string | null
  zatwierdzil: string
}
type Serwer = {
  nazwa: string
  etykieta: string
  url: string
  dodal: string
  narzedzia: Narzedzie[]
}
type Kandydat = {
  nazwaZdalna: string
  schemat: unknown
  obcyOpis: string | null
  odrzucone: string | null
  juzPrzyjete: boolean
  poprzednie: Narzedzie | null
}

/**
 * Jedyny ekran, na którym wykonuje się `tools/list` i na którym widać tekst napisany
 * przez obcego dostawcę. Zgoda dotyczy POJEDYNCZEGO narzędzia i wymaga, żeby człowiek
 * napisał o nim własnymi słowami — bo to jego zdanie, nie zdanie serwera, zobaczy model.
 */
export function NadzorMcp() {
  const [serwery, setSerwery] = useState<Serwer[]>([])
  const [zdolnosci, setZdolnosci] = useState<Zdolnosc[]>([])
  const [kandydaci, setKandydaci] = useState<Record<string, Kandydat[]>>({})
  const [zajety, setZajety] = useState<string | null>(null)
  const [nowy, setNowy] = useState(false)
  const { pokaz } = useToast()

  const wczytaj = useCallback(async () => {
    const r = await fetch(api("/mcp"), { cache: "no-store" })
    if (!r.ok) return
    const d = await r.json()
    setSerwery(d.serwery ?? [])
    setZdolnosci(d.zdolnosci ?? [])
  }, [])
  useEffect(() => {
    wczytaj()
  }, [wczytaj])

  async function wyslij(dane: Record<string, unknown>, klucz: string) {
    setZajety(klucz)
    const r = await fetch(api("/mcp"), { method: "POST", body: JSON.stringify(dane) })
    const d = await r.json().catch(() => ({}))
    setZajety(null)
    if (!r.ok) {
      pokaz({ tekst: d.blad ?? "Nie udało się.", ton: "blad" })
      return null
    }
    return d
  }

  async function przejrzyj(s: Serwer) {
    const d = await wyslij({ akcja: "przejrzyj", serwer: s.nazwa }, `p:${s.nazwa}`)
    if (d) setKandydaci((k) => ({ ...k, [s.nazwa]: d.kandydaci }))
  }

  return (
    <section className="mt-8">
      <h2 className="t-sekcja mb-1">Narzędzia spoza firmy</h2>
      <p className="t-meta mb-3">
        Każde narzędzie przyjmujesz osobno i opisujesz własnymi słowami — asystent zobaczy Twój
        opis, nigdy tekst przysłany przez dostawcę.
      </p>

      <div className="space-y-3">
        {serwery.map((s) => (
          <div key={s.nazwa} className="overflow-hidden rounded-lg border bg-surface">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <Ikona jako={Globe} px={16} klasa="shrink-0 text-cichy" />
              <div className="min-w-0 flex-1">
                <div className="t-tresc-m">{s.etykieta}</div>
                <div className="t-micro truncate">{s.url}</div>
              </div>
              <button
                onClick={() => przejrzyj(s)}
                disabled={zajety === `p:${s.nazwa}`}
                className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-raised disabled:opacity-50"
              >
                <Ikona
                  jako={RefreshCw}
                  px={14}
                  klasa={zajety === `p:${s.nazwa}` ? "obrot" : undefined}
                />
                Przejrzyj
              </button>
            </div>

            <ul className="divide-y">
              {s.narzedzia.length === 0 && (
                <li className="t-meta px-4 py-3">Nic jeszcze nie przyjęte z tego serwera.</li>
              )}
              {s.narzedzia.map((n) => (
                <li key={n.nazwaZdalna} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {n.stan === "wstrzymane" && (
                      <Ikona jako={ShieldAlert} px={16} klasa="mt-0.5 shrink-0 text-warn" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="t-tresc-m">{n.krotko}</div>
                      <div className="t-meta">{n.opis}</div>
                      <div className="t-micro pt-0.5">
                        wymaga zdolności „
                        {zdolnosci.find((z) => z.id === n.zdolnoscId)?.nazwa ?? n.zdolnoscId}”
                        {" · "}przyjął {n.zatwierdzil}
                      </div>
                      {n.stan === "wstrzymane" && (
                        <p className="t-meta mt-1.5 rounded-md bg-warn-soft px-2.5 py-1.5">
                          <span className="font-medium text-ink">Wstrzymane.</span> {n.powod} Do
                          czasu ponownego przyjęcia asystent tego nie dostaje.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (
                          await wyslij(
                            { akcja: "wycofaj", serwer: n.serwer, nazwaZdalna: n.nazwaZdalna },
                            `w:${n.nazwaZdalna}`,
                          )
                        ) {
                          pokaz({ tekst: `Wycofane: ${n.krotko}` })
                          wczytaj()
                        }
                      }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-cichy hover:bg-raised hover:text-ink"
                      aria-label={`Wycofaj ${n.krotko}`}
                    >
                      <Ikona jako={X} px={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {kandydaci[s.nazwa] && (
              <div className="border-t bg-raised/30 px-4 py-3">
                <div className="t-sekcja mb-2">Co ten serwer wystawia</div>
                <div className="space-y-3">
                  {(kandydaci[s.nazwa] ?? []).map((k) => (
                    <Kandydat
                      key={k.nazwaZdalna}
                      k={k}
                      serwer={s.nazwa}
                      zdolnosci={zdolnosci}
                      zajety={zajety === `z:${k.nazwaZdalna}`}
                      przyjmij={async (opis, krotko, zdolnosc) => {
                        const d = await wyslij(
                          {
                            akcja: "zatwierdz",
                            serwer: s.nazwa,
                            nazwaZdalna: k.nazwaZdalna,
                            opis,
                            krotko,
                            zdolnosc,
                          },
                          `z:${k.nazwaZdalna}`,
                        )
                        if (d) {
                          pokaz({ tekst: `Przyjęte: ${krotko}` })
                          await wczytaj()
                          await przejrzyj(s)
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {nowy ? (
        <NowySerwer
          anuluj={() => setNowy(false)}
          dodaj={async (nazwa, etykieta, url) => {
            if (await wyslij({ akcja: "dodaj", nazwa, etykieta, url }, "nowy")) {
              setNowy(false)
              pokaz({ tekst: `Dodano serwer ${etykieta}` })
              wczytaj()
            }
          }}
        />
      ) : (
        <button
          onClick={() => setNowy(true)}
          className="t-btn mt-3 flex h-9 items-center gap-1.5 rounded-md border px-3 hover:bg-raised"
        >
          <Ikona jako={Plus} px={14} /> Dodaj serwer
        </button>
      )}
    </section>
  )
}

function Kandydat({
  k,
  zdolnosci,
  zajety,
  przyjmij,
}: {
  k: Kandydat
  serwer: string
  zdolnosci: Zdolnosc[]
  zajety: boolean
  przyjmij: (opis: string, krotko: string, zdolnosc: string) => Promise<void>
}) {
  // Ponowne przyjęcie zaczyna od tego, co człowiek napisał poprzednio — zmienił się
  // schemat po stronie serwera, nie jego zdanie o tym, do czego to służy.
  const [opis, setOpis] = useState(k.poprzednie?.opis ?? "")
  const [krotko, setKrotko] = useState(k.poprzednie?.krotko ?? "")
  const [zdolnosc, setZdolnosc] = useState(k.poprzednie?.zdolnoscId ?? zdolnosci[0]?.id ?? "")
  const ponownie = k.poprzednie?.stan === "wstrzymane"

  if (k.odrzucone) {
    return (
      <div className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Ikona jako={TriangleAlert} px={14} klasa="mt-0.5 shrink-0 text-warn" />
          <div>
            <div className="t-tresc-m">{k.nazwaZdalna}</div>
            <p className="t-meta">{k.odrzucone}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-surface px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px]">{k.nazwaZdalna}</span>
        {k.juzPrzyjete && <span className="t-micro">już przyjęte</span>}
        {ponownie && <span className="t-micro text-warn">wstrzymane — wymaga ponownej zgody</span>}
      </div>

      {k.obcyOpis && (
        <details className="mt-1.5">
          <summary className="t-micro cursor-pointer">Co dostawca pisze o tym narzędziu</summary>
          {/* Jedyne miejsce w aplikacji, gdzie ten tekst wolno pokazać — i zawsze z etykietą,
              czyj jest. Do modelu nie trafia nigdy. */}
          <p className="t-meta mt-1 rounded-sm bg-sunken px-2.5 py-1.5">
            <span className="font-medium text-ink">Tekst dostawcy serwera, nie nasz:</span>{" "}
            {k.obcyOpis}
          </p>
        </details>
      )}

      {!k.juzPrzyjete && (
        <div className="mt-2 space-y-2">
          <input
            value={krotko}
            onChange={(e) => setKrotko(e.target.value)}
            placeholder="Krótko, co to robi — np. „sprawdzenie statusu VAT”"
            className="t-tresc h-9 w-full rounded-md border bg-bg px-2.5 outline-none placeholder:text-cichy-2"
          />
          <textarea
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            rows={2}
            placeholder="Opis dla asystenta, własnymi słowami — to zdanie zobaczy model"
            className="t-tresc w-full resize-none rounded-md border bg-bg px-2.5 py-2 outline-none placeholder:text-cichy-2"
          />
          <div className="flex items-center gap-2">
            <select
              value={zdolnosc}
              onChange={(e) => setZdolnosc(e.target.value)}
              className="t-tresc h-9 flex-1 rounded-md border bg-bg px-2"
            >
              {zdolnosci.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nazwa}
                </option>
              ))}
            </select>
            <button
              onClick={() => przyjmij(opis, krotko, zdolnosc)}
              disabled={zajety || !opis.trim() || !krotko.trim()}
              className="t-btn h-9 shrink-0 rounded-md bg-akcent px-3 text-akcent-ink hover:bg-akcent-hover disabled:opacity-40"
            >
              {ponownie ? "Przyjmij ponownie" : "Przyjmij"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NowySerwer({
  dodaj,
  anuluj,
}: {
  dodaj: (nazwa: string, etykieta: string, url: string) => Promise<void>
  anuluj: () => void
}) {
  const [nazwa, setNazwa] = useState("")
  const [etykieta, setEtykieta] = useState("")
  const [url, setUrl] = useState("")
  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-surface p-4">
      <input
        value={etykieta}
        onChange={(e) => setEtykieta(e.target.value)}
        placeholder="Nazwa dla ludzi — np. „wykaz podatników VAT”"
        className="t-tresc h-9 w-full rounded-md border bg-bg px-2.5 outline-none placeholder:text-cichy-2"
      />
      <input
        value={nazwa}
        onChange={(e) => setNazwa(e.target.value)}
        placeholder="Nazwa techniczna — małe litery i myślnik, np. biala-lista"
        className="h-9 w-full rounded-md border bg-bg px-2.5 font-mono text-[13px] outline-none placeholder:text-cichy-2"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Adres serwera MCP (Streamable HTTP)"
        className="h-9 w-full rounded-md border bg-bg px-2.5 font-mono text-[13px] outline-none placeholder:text-cichy-2"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => dodaj(nazwa, etykieta, url)}
          disabled={!nazwa || !url}
          className="t-btn h-9 rounded-md bg-akcent px-3 text-akcent-ink hover:bg-akcent-hover disabled:opacity-40"
        >
          Dodaj
        </button>
        <button onClick={anuluj} className="t-btn h-9 rounded-md border px-3 hover:bg-raised">
          Anuluj
        </button>
      </div>
    </div>
  )
}
