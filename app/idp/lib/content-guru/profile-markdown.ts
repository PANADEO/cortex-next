// Profil klienta/rynku -> blok Markdown wstrzykiwany do system promptu
// (design doc D7, `_profile_to_markdown()` z legacy). Czysta funkcja, zero
// Drizzle/I/O — dokładnie ta sama reguła co prompt-builder.ts.
//
// UWAGA — jedno źródło prawdy między generowaniem a podglądem: te same dwie
// funkcje są wołane (a) server-side w POST /api/content-guru/generate przy
// budowaniu promptu, i (b) client-side na ekranach /content-guru/client-
// profiles i /content-guru/market-profiles do renderowania "dokładnie tego,
// co realnie trafia do promptu" (design doc §4.3). Import lokalnych
// interfejsów zamiast typów z @cortex/db jest CELOWY: ten plik trafia do
// bundla klienta ("use client" komponenty), więc nie może pociągać za sobą
// Drizzle/@cortex/db.
//
// Legacy `_profile_to_markdown()` czyta wyłącznie history/description/
// products/offer/use_cases/experience (klient) i description/size_trends/
// personas/problems/needs/plans (rynek) — `logo_path`/`images_json` są
// martwe i świadomie NIE portowane (design doc "Korekty" #4).

export interface ClientProfileMarkdownFields {
  profileName: string
  history?: string | null
  description?: string | null
  products?: string | null
  offer?: string | null
  useCases?: string | null
  experience?: string | null
}

export interface MarketProfileMarkdownFields {
  profileName: string
  description?: string | null
  sizeTrends?: string | null
  personas?: string | null
  problems?: string | null
  needs?: string | null
  plans?: string | null
}

type FieldEntries<T extends { profileName: string }> = Array<
  [Exclude<keyof T, "profileName">, string]
>

const CLIENT_FIELDS: FieldEntries<ClientProfileMarkdownFields> = [
  ["history", "Historia"],
  ["description", "Opis"],
  ["products", "Produkty"],
  ["offer", "Oferta"],
  ["useCases", "Przypadki użycia"],
  ["experience", "Doświadczenie"],
]

const MARKET_FIELDS: FieldEntries<MarketProfileMarkdownFields> = [
  ["description", "Opis"],
  ["sizeTrends", "Wielkość rynku i trendy"],
  ["personas", "Persony"],
  ["problems", "Problemy"],
  ["needs", "Potrzeby"],
  ["plans", "Plany"],
]

function renderSections<T extends { profileName: string }>(
  profile: T,
  fields: FieldEntries<T>,
  heading: string,
): string {
  const lines = fields
    .map(([key, label]) => {
      const value = (profile[key] as string | null | undefined)?.trim()
      return value ? `**${label}:** ${value}` : null
    })
    .filter((line): line is string => line !== null)

  const title = `**${heading}: ${profile.profileName}**`
  return lines.length > 0 ? [title, ...lines].join("\n\n") : title
}

export function clientProfileToMarkdown(profile: ClientProfileMarkdownFields): string {
  return renderSections(profile, CLIENT_FIELDS, "Profil klienta")
}

export function marketProfileToMarkdown(profile: MarketProfileMarkdownFields): string {
  return renderSections(profile, MARKET_FIELDS, "Profil rynku")
}
