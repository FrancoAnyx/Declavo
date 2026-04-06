import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ProfileProvider } from '@/context/ProfileContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'Declavo — Catálogo B2B de Tecnología',
  description: 'Plataforma privada de visibilidad de stock entre empresas tecnológicas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <ProfileProvider>
            {children}
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
