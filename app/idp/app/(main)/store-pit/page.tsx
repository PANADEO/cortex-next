"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function StorePitIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/store-pit/dashboard")
  }, [router])
  return null
}
