import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Sora } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Picard OS',
  description: 'Personal command center for Jpicky',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Picard OS',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07070a',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased dark`}>
      <body className="h-full bg-background text-foreground font-sans">
        <ServiceWorkerRegistration />
        <Sidebar />
        <div className="h-full lg:pl-60 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto content-area no-scrollbar">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
