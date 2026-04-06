'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogOut, LayoutGrid, LogIn } from 'lucide-react'
import clsx from 'clsx'
import type { User } from '@supabase/supabase-js'

type NavProfile = {
  full_name: string | null
  role: string | null
  organization_name: string | null
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function loadProfile(u: User) {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, role, organization_id')
        .eq('id', u.id)
        .single()

      if (!p) { setProfile(null); return }

      let org_name: string | null = null
      if (p.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', p.organization_id)
          .single()
        org_name = org?.name ?? null
      }

      setProfile({
        full_name: p.full_name,
        role: p.role,
        organization_name: org_name,
      })
    }

    // Estado inicial
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u)
      if (u) await loadProfile(u)
      setReady(true)
    })

    // Cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await loadProfile(u)
        } else {
          setProfile(null)
        }
        setReady(true)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    // onAuthStateChange se encarga de limpiar el estado
    router.push('/catalogo')
    router.refresh()
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?'

  const isSuperAdmin = profile?.role === 'super_admin'

  return (
    <nav className="bg-white border-b border-brand-200 px-5 h-14 flex items-center justify-between sticky top-0 z-50">
      {/* Logo + links */}
      <div className="flex items-center gap-8">
        <Link
          href="/catalogo"
          className="flex items-center gap-2 text-brand-900 font-medium text-base"
        >
          <div className="w-6 h-6 bg-brand-900 rounded-md flex items-center justify-center">
            <LayoutGrid size={13} className="text-white" />
          </div>
          Declavo
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/catalogo"
            className={clsx('nav-link', pathname.startsWith('/catalogo') && 'nav-link-active')}
          >
            Catálogo
          </Link>

          {/* Solo para usuarios con sesión */}
          {user && (
            <Link
              href="/mis-productos"
              className={clsx('nav-link', pathname.startsWith('/mis-productos') && 'nav-link-active')}
            >
              Mis productos
            </Link>
          )}

          {isSuperAdmin && (
            <Link
              href="/admin"
              className={clsx('nav-link', pathname.startsWith('/admin') && 'nav-link-active')}
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* Derecha: sesión */}
      <div className="flex items-center gap-3">
        {/* Badge de empresa */}
        {user && profile?.organization_name && (
          <div className="flex items-center gap-1.5 bg-brand-100 border border-brand-200 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
            <span className="text-xs font-medium text-brand-500 max-w-[160px] truncate">
              {profile.organization_name}
            </span>
          </div>
        )}

        {/* Mostrar solo cuando auth ya resolvió */}
        {ready && (
          user ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-800">
                {initials}
              </div>
              <button onClick={handleLogout} className="icon-btn" title="Cerrar sesión">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary">
              <LogIn size={13} />
              Ingresar
            </Link>
          )
        )}
      </div>
    </nav>
  )
}
