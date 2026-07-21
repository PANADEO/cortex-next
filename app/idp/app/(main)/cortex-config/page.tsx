"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CortexConfigIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/cortex-config/projects")
  }, [router])
  return null
}
