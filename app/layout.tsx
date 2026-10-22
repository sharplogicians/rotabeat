import { Analytics } from '@vercel/analytics/next'

import type { Metadata, Viewport } from 'next'
import { Manrope, Inter } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppStoreProvider } from '@/lib/store'
import './globals.css'

const heading = Manrope({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RotaFlow — Workforce management, simplified.',
  description:
    'RotaFlow helps UK businesses build rotas, track attendance and approve payable hours without the paperwork.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#101c36',
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-GB" className={`bg-background ${heading.variable} ${body.variable}`}>
      <body className="antialiased font-sans">
        <AppStoreProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-right" closeButton offset={{ top: "80px", right: "24px" }} richColors />
          </TooltipProvider>
        </AppStoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
