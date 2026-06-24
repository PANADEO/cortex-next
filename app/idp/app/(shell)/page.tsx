import { redirect } from "next/navigation"
import { HomePageClient } from "@/components/shell/home-page-client"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const defaultPath = normalizeDefaultPath(process.env.CORTEX_FRONTEND_DEFAULT_PATH)
  if (defaultPath) redirect(defaultPath)

  return <HomePageClient />
}

function normalizeDefaultPath(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return null
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}
