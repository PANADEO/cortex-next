import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

// latin-ext jest obowiązkowy — bez niego „Zleć" i „Księgowość" lecą na font zastępczy.
const text = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--desk-f-tekst",
  display: "swap",
})

export const metadata: Metadata = { title: "Biurko — Cortex", description: "Twoje biurko" }
export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={text.variable}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
