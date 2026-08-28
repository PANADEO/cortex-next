import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata, Viewport } from 'next'

// latin-ext jest obowiązkowy — bez niego „Zleć" i „Księgowość" lecą na font zastępczy.
const tekst = Inter({ subsets: ['latin', 'latin-ext'], variable: '--f-tekst', display: 'swap' })

export const metadata: Metadata = { title: 'Biurko — Cortex', description: 'Twoje biurko' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={tekst.variable}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
