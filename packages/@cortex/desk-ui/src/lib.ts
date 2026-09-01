import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...i: ClassValue[]) {
  return twMerge(clsx(i))
}
export function zl(usd: number) {
  const kurs = Number(process.env.NEXT_PUBLIC_USD_PLN ?? 4)
  return `${(usd * kurs).toFixed(2).replace(".", ",")} zł`
}
export function rozmiar(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} kB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
export function kiedy(iso: string) {
  const d = new Date(iso),
    teraz = Date.now(),
    m = Math.round((teraz - d.getTime()) / 60000)
  if (m < 1) return "przed chwilą"
  if (m < 60) return `${m} min temu`
  if (m < 60 * 24) return `${Math.round(m / 60)} godz. temu`
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })
}

/**
 * Polska odmiana liczebnika: 1 plik · 2 pliki · 5 plików · 22 pliki · 25 plików.
 * Podajesz trzy formy — pojedynczą, mnogą "kilka" i mnogą dopełniaczową.
 */
export function ile(n: number, jeden: string, kilka: string, wiele: string) {
  const d = n % 10
  const s = n % 100
  if (n === 1) return `${n} ${jeden}`
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${kilka}`
  return `${n} ${wiele}`
}
