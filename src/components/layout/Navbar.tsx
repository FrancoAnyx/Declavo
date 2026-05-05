'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useProfile } from '@/context/ProfileContext'
import { useTheme } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'

function MoonIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function SunIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function LogOutIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }

export default function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, loading } = useProfile()
  const { theme, toggle } = useTheme()
  const supabase = createClient()

  const profile      = user?.profile ?? null
  const organization = user?.organization ?? null
  const role         = profile?.role ?? null

  const isActive    = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const displayName = organization?.name ?? profile?.full_name ?? ''
  const initials    = displayName ? displayName.slice(0, 2).toUpperCase() : '?'

  // Links según rol
  // member: solo Catálogo y Mis Chats (para hacer consultas y ver respuestas)
  // org_admin: Catálogo, Mis Productos, Mis Chats
  // super_admin: todo + Admin
  const navLinks = [
    { href: '/catalogo',      label: 'Catálogo',      roles: ['super_admin', 'org_admin', 'member', null] },
    { href: '/mis-productos', label: 'Mis Productos',  roles: ['super_admin', 'org_admin'] },
    { href: '/mis-chats',     label: 'Mis Chats',      roles: ['super_admin', 'org_admin', 'member'] },
    { href: '/admin',         label: 'Admin',          roles: ['super_admin'] },
  ].filter(l => l.roles.includes(role))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/catalogo')
    router.refresh()
  }

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 64,
      display: 'flex', alignItems: 'center', padding: '0 24px',
      backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)', transition: 'background 0.25s, border-color 0.25s',
    }}>
      {/* Logo */}
      <Link href="/catalogo" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 28 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
        <span style={{ fontFamily: 'Syne, -apple-system, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          Declavo
        </span>
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {navLinks.map(link => (
          <Link key={link.href} href={link.href} style={{
            padding: '6px 14px', borderRadius: 9, fontSize: 14, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.18s',
            color: isActive(link.href) ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive(link.href) ? 'var(--accent-glow)' : 'transparent',
          }}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Campana de notificaciones (solo logueados con empresa) */}
      {!loading && profile && <NotificationBell />}

      {/* Tema */}
      <button onClick={toggle} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} style={{
        width: 38, height: 38, borderRadius: 9, marginRight: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.18s',
        background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
      }}>
        {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>

      {/* Badge empresa */}
      {!loading && profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), var(--accent3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayName && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                {role === 'super_admin' ? 'Super Admin' : role === 'org_admin' ? 'Administrador' : 'Miembro'}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} title="Cerrar sesión" style={{
            width: 34, height: 34, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.18s',
            background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
          }}>
            <LogOutIcon />
          </button>
        </div>
      )}

      {/* Login para no autenticados */}
      {!loading && !profile && (
        <Link href="/login" style={{
          padding: '7px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600,
          textDecoration: 'none', color: '#fff', background: 'var(--accent)', transition: 'all 0.18s',
        }}>
          Iniciar sesión
        </Link>
      )}
    </header>
  )
}
