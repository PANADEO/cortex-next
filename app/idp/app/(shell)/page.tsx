import { HomePageClient } from "@/components/shell/home-page-client"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const idpTileHref = normalizeTileHref(process.env.CORTEX_FRONTEND_IDP_TILE_HREF)
  const tileHrefOverrides = idpTileHref ? { idp: idpTileHref } : undefined

  return <HomePageClient tileHrefOverrides={tileHrefOverrides} />
}

function normalizeTileHref(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return null
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}
