"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function SystemConfigIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/system-config/uzytkownicy")
  }, [router])
  return null
}
