import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = { title: 'Biurko — Cortex', description: 'Twoje biurko' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
