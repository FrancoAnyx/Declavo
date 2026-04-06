'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const SIDEBAR_W = 240

// Ícono SVG genérico
function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

interface SidebarItemProps {
  href?: string
  label: string
  icon?: React.ReactNode
  badge?: number
  active?: boolean
  onClick?: () => void
}

function SidebarItem({ href, label, icon, badge, active, onClick }: SidebarItemProps) {
  const content = (
    <span
      className={`sidebar-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--accent)', color: '#fff', fontSize: 10 }}
        >
          {badge}
        </span>
      )}
    </span>
  )

  if (href) return <Link href={href} className="no-underline block">{content}</Link>
  return content
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block px-3 pt-2 pb-1 text-xs font-bold tracking-widest uppercase"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </span>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '6px 12px' }} />
}

interface CatalogoSidebarProps {
  brands?: string[]
  categories?: string[]
  selectedBrand?: string | null
  selectedCategory?: string | null
  selectedAvail?: string | null
  onBrand?: (b: string | null) => void
  onCategory?: (c: string | null) => void
  onAvail?: (a: string | null) => void
}

export default function CatalogoSidebar({
  brands = [],
  categories = [],
  selectedBrand,
  selectedCategory,
  selectedAvail,
  onBrand,
  onCategory,
  onAvail,
}: CatalogoSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed bottom-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1"
      style={{
        width: SIDEBAR_W,
        top: 64,
        left: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        padding: '16px 10px',
        zIndex: 40,
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* Navegación principal */}
      <div className="mb-1">
        <SidebarLabel>Principal</SidebarLabel>
        <SidebarItem
          href="/catalogo"
          label="Catálogo General"
          active={pathname === '/catalogo'}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          }
        />
        <SidebarItem
          href="/mis-productos"
          label="Mis Productos"
          active={pathname === '/mis-productos'}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          }
        />
      </div>

      {/* Filtro Marca — siempre visible y expandido */}
      {brands.length > 0 && (
        <>
          <Divider />
          <div className="mb-1">
            <SidebarLabel>Marca</SidebarLabel>
            <SidebarItem
              label="Todas"
              active={!selectedBrand}
              onClick={() => onBrand?.(null)}
              icon={<span style={{ color: 'var(--text-muted)', fontSize: 14 }}>○</span>}
            />
            {brands.map(b => (
              <SidebarItem
                key={b}
                label={b}
                active={selectedBrand === b}
                onClick={() => onBrand?.(selectedBrand === b ? null : b)}
                icon={<span style={{ color: 'var(--text-muted)', fontSize: 14 }}>◉</span>}
              />
            ))}
          </div>
        </>
      )}

      {/* Filtro Categoría — colapsable */}
      {categories.length > 0 && (
        <>
          <Divider />
          <CollapsibleSection title="Categoría" defaultOpen={false}>
            <SidebarItem
              label="Todas"
              active={!selectedCategory}
              onClick={() => onCategory?.(null)}
            />
            {categories.map(c => (
              <SidebarItem
                key={c}
                label={c}
                active={selectedCategory === c}
                onClick={() => onCategory?.(selectedCategory === c ? null : c)}
              />
            ))}
          </CollapsibleSection>
        </>
      )}

      {/* Filtro Disponibilidad */}
      <>
        <Divider />
        <CollapsibleSection title="Disponibilidad" defaultOpen={false}>
          {[
            { val: null,        label: 'Todos' },
            { val: 'instock',   label: 'Con stock' },
            { val: 'lowstock',  label: 'Stock bajo' },
            { val: 'nostock',   label: 'Sin stock' },
          ].map(opt => (
            <SidebarItem
              key={String(opt.val)}
              label={opt.label}
              active={selectedAvail === opt.val}
              onClick={() => onAvail?.(opt.val)}
            />
          ))}
        </CollapsibleSection>
      </>
    </aside>
  )
}

// Sección colapsable
function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  // Usamos estado local; como es client component está bien
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 pt-2 pb-1 transition-colors duration-200"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// useState import
import { useState } from 'react'
