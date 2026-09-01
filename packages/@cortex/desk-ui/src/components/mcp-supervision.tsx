"use client"
import type { Capability, McpToolStatus } from "@cortex/desk-core/types"
import { Globe, Plus, RefreshCw, ShieldAlert, TriangleAlert, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

type Tool = {
  server: string
  remoteName: string
  description: string
  shortLabel: string
  capabilityId: string
  fingerprint: string
  status: McpToolStatus
  reason: string | null
  approvedBy: string
}
type Server = {
  name: string
  label: string
  url: string
  addedBy: string
  tools: Tool[]
}
type Candidate = {
  remoteName: string
  schema: unknown
  foreignDescription: string | null
  rejected: string | null
  alreadyAccepted: boolean
  previous: Tool | null
}

/**
 * Jedyny ekran, na którym wykonuje się `tools/list` i na którym widać tekst napisany
 * przez obcego dostawcę. Zgoda dotyczy POJEDYNCZEGO narzędzia i wymaga, żeby człowiek
 * napisał o nim własnymi słowami — bo to jego zdanie, nie zdanie serwera, zobaczy model.
 */
export function McpSupervision() {
  const [servers, setServers] = useState<Server[]>([])
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [newForm, setNewForm] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    const r = await fetch(api("/mcp"), { cache: "no-store" })
    if (!r.ok) return
    const d = await r.json()
    setServers(d.servers ?? [])
    setCapabilities(d.capabilities ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function send(data: Record<string, unknown>, key: string) {
    setBusy(key)
    const r = await fetch(api("/mcp"), { method: "POST", body: JSON.stringify(data) })
    const d = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) {
      toast({ text: d.error ?? "Nie udało się.", tone: "error" })
      return null
    }
    return d
  }

  async function inspect(s: Server) {
    const d = await send({ action: "inspect", server: s.name }, `p:${s.name}`)
    if (d) setCandidates((k) => ({ ...k, [s.name]: d.candidates }))
  }

  return (
    <section className="mt-8">
      <h2 className="t-section mb-1">Narzędzia spoza firmy</h2>
      <p className="t-meta mb-3">
        Każde narzędzie przyjmujesz osobno i opisujesz własnymi słowami — asystent zobaczy Twój
        opis, nigdy tekst przysłany przez dostawcę.
      </p>

      <div className="space-y-3">
        {servers.map((s) => (
          <div key={s.name} className="overflow-hidden rounded-lg border bg-desk-surface">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <Icon as={Globe} px={16} className="shrink-0 text-desk-muted" />
              <div className="min-w-0 flex-1">
                <div className="t-body-m">{s.label}</div>
                <div className="t-micro truncate">{s.url}</div>
              </div>
              <button
                onClick={() => inspect(s)}
                disabled={busy === `p:${s.name}`}
                className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised disabled:opacity-50"
              >
                <Icon
                  as={RefreshCw}
                  px={14}
                  className={busy === `p:${s.name}` ? "spin" : undefined}
                />
                Przejrzyj
              </button>
            </div>

            <ul className="divide-y">
              {s.tools.length === 0 && (
                <li className="t-meta px-4 py-3">Nic jeszcze nie przyjęte z tego serwera.</li>
              )}
              {s.tools.map((n) => (
                <li key={n.remoteName} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {n.status === "suspended" && (
                      <Icon as={ShieldAlert} px={16} className="mt-0.5 shrink-0 text-desk-warn" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="t-body-m">{n.shortLabel}</div>
                      <div className="t-meta">{n.description}</div>
                      <div className="t-micro pt-0.5">
                        wymaga zdolności „
                        {capabilities.find((z) => z.id === n.capabilityId)?.name ?? n.capabilityId}”
                        {" · "}przyjął {n.approvedBy}
                      </div>
                      {n.status === "suspended" && (
                        <p className="t-meta mt-1.5 rounded-md bg-desk-warn-soft px-2.5 py-1.5">
                          <span className="font-medium text-desk-ink">Wstrzymane.</span> {n.reason}{" "}
                          Do czasu ponownego przyjęcia asystent tego nie dostaje.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (
                          await send(
                            { action: "withdraw", server: n.server, remoteName: n.remoteName },
                            `w:${n.remoteName}`,
                          )
                        ) {
                          toast({ text: `Wycofane: ${n.shortLabel}` })
                          load()
                        }
                      }}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
                      aria-label={`Wycofaj ${n.shortLabel}`}
                    >
                      <Icon as={X} px={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {candidates[s.name] && (
              <div className="border-t bg-desk-raised/30 px-4 py-3">
                <div className="t-section mb-2">Co ten serwer wystawia</div>
                <div className="space-y-3">
                  {(candidates[s.name] ?? []).map((k) => (
                    <Candidate
                      key={k.remoteName}
                      k={k}
                      server={s.name}
                      capabilities={capabilities}
                      busy={busy === `z:${k.remoteName}`}
                      accept={async (description, shortLabel, capability) => {
                        const d = await send(
                          {
                            action: "approve",
                            server: s.name,
                            remoteName: k.remoteName,
                            description,
                            shortLabel,
                            capability,
                          },
                          `z:${k.remoteName}`,
                        )
                        if (d) {
                          toast({ text: `Przyjęte: ${shortLabel}` })
                          await load()
                          await inspect(s)
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

      {newForm ? (
        <NewServer
          cancel={() => setNewForm(false)}
          add={async (name, label, url) => {
            if (await send({ action: "add", name, label, url }, "new")) {
              setNewForm(false)
              toast({ text: `Dodano serwer ${label}` })
              load()
            }
          }}
        />
      ) : (
        <button
          onClick={() => setNewForm(true)}
          className="t-btn mt-3 flex h-9 items-center gap-1.5 rounded-md border px-3 hover:bg-desk-raised"
        >
          <Icon as={Plus} px={14} /> Dodaj serwer
        </button>
      )}
    </section>
  )
}

function Candidate({
  k,
  capabilities,
  busy,
  accept,
}: {
  k: Candidate
  server: string
  capabilities: Capability[]
  busy: boolean
  accept: (description: string, shortLabel: string, capability: string) => Promise<void>
}) {
  // Ponowne przyjęcie zaczyna od tego, co człowiek napisał poprzednio — zmienił się
  // schemat po stronie serwera, nie jego zdanie o tym, do czego to służy.
  const [description, setDescription] = useState(k.previous?.description ?? "")
  const [shortLabel, setShortLabel] = useState(k.previous?.shortLabel ?? "")
  const [capability, setCapability] = useState(
    k.previous?.capabilityId ?? capabilities[0]?.id ?? "",
  )
  const again = k.previous?.status === "suspended"

  if (k.rejected) {
    return (
      <div className="rounded-md border border-desk-warn/40 bg-desk-warn-soft px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Icon as={TriangleAlert} px={14} className="mt-0.5 shrink-0 text-desk-warn" />
          <div>
            <div className="t-body-m">{k.remoteName}</div>
            <p className="t-meta">{k.rejected}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-desk-surface px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px]">{k.remoteName}</span>
        {k.alreadyAccepted && <span className="t-micro">już przyjęte</span>}
        {again && (
          <span className="t-micro text-desk-warn">wstrzymane — wymaga ponownej zgody</span>
        )}
      </div>

      {k.foreignDescription && (
        <details className="mt-1.5">
          <summary className="t-micro cursor-pointer">Co dostawca pisze o tym narzędziu</summary>
          {/* Jedyne miejsce w aplikacji, gdzie ten tekst wolno pokazać — i zawsze z etykietą,
              czyj jest. Do modelu nie trafia nigdy. */}
          <p className="t-meta mt-1 rounded-sm bg-desk-sunken px-2.5 py-1.5">
            <span className="font-medium text-desk-ink">Tekst dostawcy serwera, nie nasz:</span>{" "}
            {k.foreignDescription}
          </p>
        </details>
      )}

      {!k.alreadyAccepted && (
        <div className="mt-2 space-y-2">
          <input
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
            placeholder="Krótko, co to robi — np. „sprawdzenie statusu VAT”"
            className="t-body h-9 w-full rounded-md border bg-desk-bg px-2.5 outline-none placeholder:text-desk-muted-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Opis dla asystenta, własnymi słowami — to zdanie zobaczy model"
            className="t-body w-full resize-none rounded-md border bg-desk-bg px-2.5 py-2 outline-none placeholder:text-desk-muted-2"
          />
          <div className="flex items-center gap-2">
            <select
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
              className="t-body h-9 flex-1 rounded-md border bg-desk-bg px-2"
            >
              {capabilities.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => accept(description, shortLabel, capability)}
              disabled={busy || !description.trim() || !shortLabel.trim()}
              className="t-btn h-9 shrink-0 rounded-md bg-desk-accent px-3 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-40"
            >
              {again ? "Przyjmij ponownie" : "Przyjmij"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewServer({
  add,
  cancel,
}: {
  add: (name: string, label: string, url: string) => Promise<void>
  cancel: () => void
}) {
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-desk-surface p-4">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nazwa dla ludzi — np. „wykaz podatników VAT”"
        className="t-body h-9 w-full rounded-md border bg-desk-bg px-2.5 outline-none placeholder:text-desk-muted-2"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa techniczna — małe litery i myślnik, np. vat-registry"
        className="h-9 w-full rounded-md border bg-desk-bg px-2.5 font-mono text-[13px] outline-none placeholder:text-desk-muted-2"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Adres serwera MCP (Streamable HTTP)"
        className="h-9 w-full rounded-md border bg-desk-bg px-2.5 font-mono text-[13px] outline-none placeholder:text-desk-muted-2"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => add(name, label, url)}
          disabled={!name || !url}
          className="t-btn h-9 rounded-md bg-desk-accent px-3 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-40"
        >
          Dodaj
        </button>
        <button onClick={cancel} className="t-btn h-9 rounded-md border px-3 hover:bg-desk-raised">
          Anuluj
        </button>
      </div>
    </div>
  )
}
