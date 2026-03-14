import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CivicSolve – Community Intelligence Platform',
  description: 'Report local issues, discover safe routes, and stay aware of danger zones in real time.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
