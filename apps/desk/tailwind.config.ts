import type { Config } from "tailwindcss"
import korzen from "../../tailwind.config"

/**
 * JEDEN config na repozytorium — ten plik tylko dokłada do niego ścieżki.
 *
 * Motyw Biurka mieszka w konfiguracji korzenia razem z motywem powłoki, bo pod
 * powłoką i tak obowiązuje wyłącznie tamten plik. Drugi, własny motyw znaczyłby
 * dwa źródła prawdy o wyglądzie i jedno z nich cicho nieaktualne: to, którego
 * nie widzi klient.
 */
export default {
  ...korzen,
  content: ["./src/**/*.{ts,tsx}", "../../packages/@cortex/desk-{ui,app}/src/**/*.{ts,tsx}"],
} satisfies Config
