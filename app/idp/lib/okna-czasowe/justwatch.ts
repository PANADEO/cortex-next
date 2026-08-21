// Client for the public JustWatch GraphQL API (no API key required). Used server-side only
// (route handlers), never imported from client components.
//
// Verified live against https://apis.justwatch.com/graphql on 2026-07-03. Note the Rakuten TV
// package's `technicalName` is "wuaki" (JustWatch's historical id for it), NOT "rakutentv" —
// match on `clearName` containing "Rakuten" as the primary signal, "wuaki" as a fast-path.
import type { Film } from "@/features/okna-czasowe/types"

const JUSTWATCH_ENDPOINT = "https://apis.justwatch.com/graphql"
const COUNTRY = "PL"
const LANGUAGE = "pl"

const SEARCH_TITLES_QUERY = `
  query GetSearchTitles($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter!) {
    popularTitles(country: $country, first: $first, filter: $filter) {
      edges {
        node {
          id
          objectType
          content(country: $country, language: $language) {
            title
            originalReleaseYear
            fullPath
          }
          offers(country: $country, platform: WEB) {
            monetizationType
            presentationType
            retailPrice(language: $language)
            currency
            package {
              clearName
              technicalName
            }
            standardWebURL
          }
        }
      }
    }
  }
`

interface JustWatchOfferPackage {
  clearName: string
  technicalName: string
}

interface JustWatchOffer {
  monetizationType: string
  presentationType: string
  retailPrice: string | null
  currency: string | null
  package: JustWatchOfferPackage
  standardWebURL: string | null
}

interface JustWatchContent {
  title: string
  originalReleaseYear: number | null
  fullPath: string
}

interface JustWatchNode {
  id: string
  objectType: string
  content: JustWatchContent
  offers: JustWatchOffer[]
}

interface JustWatchSearchResponse {
  data?: {
    popularTitles?: {
      edges?: Array<{ node: JustWatchNode }>
    }
  }
  errors?: Array<{ message: string }>
}

async function searchJustWatchTitles(searchQuery: string, first = 4): Promise<JustWatchNode[]> {
  const response = await fetch(JUSTWATCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: SEARCH_TITLES_QUERY,
      variables: {
        country: COUNTRY,
        language: LANGUAGE,
        first,
        filter: { searchQuery },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`JustWatch search failed for "${searchQuery}": HTTP ${response.status}`)
  }

  const body = (await response.json()) as JustWatchSearchResponse
  const firstError = body.errors?.[0]
  if (firstError) {
    throw new Error(`JustWatch search error for "${searchQuery}": ${firstError.message}`)
  }

  return body.data?.popularTitles?.edges?.map((edge) => edge.node) ?? []
}

const RAKUTEN_TECHNICAL_NAMES = new Set(["wuaki"])

function isRakutenOffer(offer: JustWatchOffer): boolean {
  return (
    RAKUTEN_TECHNICAL_NAMES.has(offer.package.technicalName) ||
    offer.package.clearName.toLowerCase().includes("rakuten")
  )
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

function titleMatches(node: JustWatchNode, candidateTitles: readonly string[]): boolean {
  const nodeTitle = normalizeTitle(node.content.title)
  return candidateTitles.some((title) => normalizeTitle(title) === nodeTitle)
}

function yearMatches(node: JustWatchNode, year: number): boolean {
  // Missing release year on the JustWatch side shouldn't exclude an otherwise exact title match.
  if (node.content.originalReleaseYear == null) return true
  return Math.abs(node.content.originalReleaseYear - year) <= 1
}

/** RENT is the offer type most relevant for "just became available" — prefer it over BUY/FLATRATE. */
function pickPreferredOffer(offers: readonly JustWatchOffer[]): JustWatchOffer | undefined {
  return offers.find((offer) => offer.monetizationType === "RENT") ?? offers[0]
}

export interface RakutenMatch {
  matchedTitle: string | null
  available: boolean
  offerType: string | null
  price: string | null
  /** Search returned candidates but none matched title+year confidently. */
  ambiguous: boolean
}

const NO_MATCH: RakutenMatch = {
  matchedTitle: null,
  available: false,
  offerType: null,
  price: null,
  ambiguous: false,
}

export async function findRakutenAvailability(
  film: Pick<Film, "title" | "year" | "foreignTitles">,
): Promise<RakutenMatch> {
  const candidateTitles = [film.title, ...film.foreignTitles]
  let sawAnyCandidate = false

  for (const searchTitle of candidateTitles) {
    const nodes = await searchJustWatchTitles(searchTitle)
    const movieNodes = nodes.filter((node) => node.objectType === "MOVIE")
    if (movieNodes.length > 0) sawAnyCandidate = true

    const exact = movieNodes.find(
      (node) => titleMatches(node, candidateTitles) && yearMatches(node, film.year),
    )
    if (!exact) continue

    const rakutenOffers = exact.offers.filter(isRakutenOffer)
    const chosen = pickPreferredOffer(rakutenOffers)
    if (!chosen) {
      return {
        matchedTitle: exact.content.title,
        available: false,
        offerType: null,
        price: null,
        ambiguous: false,
      }
    }
    return {
      matchedTitle: exact.content.title,
      available: true,
      offerType: chosen.monetizationType,
      price: chosen.retailPrice,
      ambiguous: false,
    }
  }

  return { ...NO_MATCH, ambiguous: sawAnyCandidate }
}
