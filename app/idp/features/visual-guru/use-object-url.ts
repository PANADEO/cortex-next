"use client"

import { useEffect, useState } from "react"

/** Własna kopia, NIE import z features/ilustromat/use-object-url.ts (design
 *  doc sekcja 1.2: zbyt małe/generyczne, żeby uzasadnić wydzielenie na bazie
 *  jednego drugiego konsumenta — ekstrakcja dopiero przy trzecim). */
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

/** Wersja dla LISTY plików — miniatury wgranych obrazów referencyjnych.
 *  FileUploader (@cortex/ui) renderuje tylko generyczną ikonę pliku + nazwę,
 *  nie podgląd obrazu (zweryfikowane w kodzie komponentu) — te miniatury
 *  dokładają to, czego brakuje, bez modyfikowania współdzielonego komponentu. */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file))
    setUrls(next)
    return () => {
      for (const url of next) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  return urls
}
