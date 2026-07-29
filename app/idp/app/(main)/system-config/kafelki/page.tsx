"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/** Stary adres "Rejestru kafelków" — encja nazywa się dziś Aplikacje. */
export default function KafelkiRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/system-config/aplikacje")
  }, [router])
  return null
}
