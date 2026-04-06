'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'
import { useProfile } from '@/context/ProfileContext'

// Íconos SVG inline livianos
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

const NAV_LINKS = [
  { href: '/catalogo',      label: 'Catálogo' },
  { href: '/mis-productos', label: 'Mis Productos' },
]

const ADMIN_LINK = { href: '/admin', label: 'Admin' }

export default function Navbar() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { profile } = useProfile()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const orgInitials = profile?.organization?.name
    ? profile.organization.name.slice(0, 2).toUpperCase()
    : '??'

  const links = profile?.role === 'super_admin'
    ? [...NAV_LINKS, ADMIN_LINK]
    : NAV_LINKS

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-6"
      style={{
        height: 64,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Logo */}
      <Link href="/catalogo" className="flex items-center gap-2 no-underline">
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 10px var(--accent)',
            flexShrink: 0,
          }}
        />
        <span
          className="font-display font-extrabold text-xl tracking-tight"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}
        >
          Declavo
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-8">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 no-underline"
            style={{
              color: isActive(link.href) ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive(link.href) ? 'var(--accent-glow)' : 'transparent',
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="flex items-center justify-center rounded-xl transition-all duration-200"
        style={{
          width: 40, height: 40,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>

      {/* Company badge */}
      {profile && (
        <div
          className="flex items-center gap-2 rounded-xl transition-all duration-200"
          style={{
            padding: '4px 12px 4px 4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Avatar */}
          <div
            className="flex items-center justify-center rounded-xl font-display font-bold text-xs text-white flex-shrink-0"
            style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, var(--accent), var(--accent3))',
            }}
          >
            {orgInitials}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {profile.organization?.name ?? profile.full_name ?? 'Mi empresa'}
          </span>
        </div>
      )}
    </header>
  )
}
