import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no hacer nada entre createServerClient y getUser()
  // que pueda interferir con las cookies de sesión.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ─── Rutas completamente públicas (sin auth requerida) ───────────────────
  // /catalogo: cualquier visitante puede ver los productos
  // /login: formulario de acceso
  // /invite: registro por invitación
  const PUBLIC_PATHS = ['/catalogo', '/login', '/invite']
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Si no hay sesión y la ruta no es pública → redirigir al CATÁLOGO (no al login)
  // así los visitantes sin sesión siempre aterrizan en el catálogo
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/catalogo'
    return NextResponse.redirect(url)
  }

  // ─── Proteger /admin: solo super_admin ──────────────────────────────────
  if (pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/catalogo'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
