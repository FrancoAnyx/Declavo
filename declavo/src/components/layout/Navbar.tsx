'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { LogOut, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'

const links = [
  { href: '/catalogo',       label: 'Catálogo' },
  { href: '/mis-productos',  label: 'Mis productos' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useProfile()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.profile?.full_name
    ? user.profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <nav className="bg-white border-b border-brand-200 px-5 h-14 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/catalogo" className="flex items-center gap-2 text-brand-900 font-medium text-base">
          <div className="w-6 h-6 bg-brand-900 rounded-md flex items-center justify-center">
            <LayoutGrid size={13} className="text-white" />
          </div>
          Declavo
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-5">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx('nav-link', pathname.startsWith(l.href) && 'nav-link-active')}
            >
              {l.label}
            </Link>
          ))}
          {user?.profile?.role === 'super_admin' && (
            <Link
              href="/admin"
              className={clsx('nav-link', pathname.startsWith('/admin') && 'nav-link-active')}
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!loading && user?.organization && (
          <div className="flex items-center gap-1.5 bg-brand-100 border border-brand-200 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 flex-shrink-0" />
            <span className="text-xs font-medium text-brand-500 max-w-[160px] truncate">
              {user.organization.name}
            </span>
          </div>
        )}

        {!loading && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-medium text-purple-800">
              {initials}
            </div>
            <button onClick={handleLogout} className="icon-btn" title="Cerrar sesión">
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
