import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import { ProfileProvider } from '@/context/ProfileContext'
import './globals.css'
 
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' })
 
export const metadata: Metadata = {
  title: 'Declavo — Stock tech entre colegas',
  description: 'Plataforma de visibilidad de stock para empresas tecnológicas',
}
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="bg-brand-50 text-brand-900 font-sans antialiased">
        <ProfileProvider>
          {children}
        </ProfileProvider>
      </body>
    </html>
  )
}
 
