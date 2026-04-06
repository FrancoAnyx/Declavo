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
    /*
     * suppressHydrationWarning es necesario porque ThemeProvider agrega/remueve
     * la clase .light en <html> del lado del cliente (localStorage), lo que
     * genera una discrepancia entre el HTML del servidor y el del cliente.
     * Este warning es esperado y seguro en este patrón de dark mode.
     */
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Fuentes: carga rápida con preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
         * ThemeProvider: solo maneja la clase CSS .light en <html>.
         * No hace ninguna llamada a Supabase ni a la API.
         * Es seguro envolverlo alrededor de ProfileProvider.
         */}
        <ThemeProvider>
          <ProfileProvider>
            {children}
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
