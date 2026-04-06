import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas EXCEPTO assets estáticos.
     * /catalogo es pública — el control de acceso se hace dentro de updateSession.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
