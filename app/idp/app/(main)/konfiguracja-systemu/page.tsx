"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function KonfiguracjaSystemuIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/konfiguracja-systemu/uzytkownicy")
  }, [router])
  return null
}
