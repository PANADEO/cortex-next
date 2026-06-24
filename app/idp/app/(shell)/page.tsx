import { redirect } from "next/navigation"
import { HomePageClient } from "@/components/shell/home-page-client"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const defaultPath = normalizeDefaultPath(process.env.CORTEX_FRONTEND_DEFAULT_PATH)
  if (defaultPath) redirect(withBasePath(defaultPath))

  return <HomePageClient />
}

function normalizeDefaultPath(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return null
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function withBasePath(pathname: string): string {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
  return basePath ? `${basePath}${pathname}` : pathname
}

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}
