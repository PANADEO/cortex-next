"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CortexCoworkIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/cortex-cowork/chat")
  }, [router])
  return null
}
