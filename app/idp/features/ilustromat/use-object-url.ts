"use client"

import { useEffect, useState } from "react"

/** Zamienia Bloba na URL do <img> i ZWALNIA poprzedni przy każdej zmianie.
 *  Bez tego rekompozycja przy pisaniu (jeden Blob na naciśnięcie klawisza)
 *  wycieka pamięcią przez całą sesję. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  return url
}

/** base64 -> data URI dla <img>. Warianty wracają z API jako base64, żeby
 *  jeden JSON niósł i tło, i gotowy kafelek. */
export function toPngDataUrl(base64: string): string {
  return `data:image/png;base64,${base64}`
}
