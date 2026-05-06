import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Excluir /api/* y /auth/* del matcher: esas rutas manejan su propia autenticación
  // y no deben ser redirigidas al catálogo por el middleware de sesión.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|api(?:/.*)?|auth(?:/.*)?).*)',
  ],
}
