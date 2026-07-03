"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function OknaCzasoweIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/okna-czasowe/dashboard")
  }, [router])
  return null
}
