"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function IlustromatIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/ilustromat/generation")
  }, [router])
  return null
}
