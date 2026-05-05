'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const SIDEBAR_W = 240

/* ── Íconos ── */
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{
        flexShrink: 0,
        color: 'var(--text-muted)',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function GridIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function BoxIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}

/* ── SidebarItem ── */
interface ItemProps {
  href?: string
  label: string
  icon?: React.ReactNode
  badge?: number | string
  active?: boolean
  onClick?: () => void
  indent?: boolean
}

function SidebarItem({ href, label, icon, badge, active, onClick, indent }: ItemProps) {
  const cls = `sidebar-item${active ? ' active' : ''}`
  const style: React.CSSProperties = indent ? { paddingLeft: 28 } : {}

  const inner = (
    <>
      {icon && <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {badge != null && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
          background: 'var(--accent)', color: '#fff', flexShrink: 0,
        }}>{badge}</span>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} style={style} onClick={onClick}>
      {inner}
    </button>
  )
}

/* ── Sección con label + botón colapso ── */
function SidebarSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '7px 12px 4px',
          background: 'none', border: 'none', cursor: 'pointer',
          gap: 6,
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          {title}
        </span>
        <ChevronDown open={open} />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '6px 12px' }} />
}

/* ── Props ── */
export interface CatalogoSidebarProps {
  brands?: string[]
  categories?: string[]
  selectedBrand?: string | null
  selectedCategory?: string | null
  selectedAvail?: string | null
  onBrand?: (b: string | null) => void
  onCategory?: (c: string | null) => void
  onAvail?: (a: string | null) => void
}

/* ── Componente principal ── */
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
      style={{
        position: 'fixed', top: 64, bottom: 0, left: 0,
        width: SIDEBAR_W, zIndex: 40,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        padding: '12px 8px 20px',
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 2,
        transition: 'background 0.25s, border-color 0.25s',
      }}
    >
      {/* Navegación */}
      <SidebarSection title="Menú" defaultOpen={true}>
        <SidebarItem
          href="/catalogo"
          label="Catálogo General"
          active={pathname === '/catalogo'}
          icon={<GridIcon />}
        />
        <SidebarItem
          href="/mis-productos"
          label="Mis Productos"
          active={pathname === '/mis-productos'}
          icon={<BoxIcon />}
        />
      </SidebarSection>

      {/* Filtro Marcas — colapsable, abierto por defecto */}
      {brands.length > 0 && (
        <>
          <Divider />
          <SidebarSection title="Marca" defaultOpen={true}>
            <SidebarItem
              label="Todas las marcas"
              active={!selectedBrand}
              onClick={() => onBrand?.(null)}
            />
            {brands.map(b => (
              <SidebarItem
                key={b}
                label={b}
                active={selectedBrand === b}
                onClick={() => onBrand?.(selectedBrand === b ? null : b)}
                indent
              />
            ))}
          </SidebarSection>
        </>
      )}

      {/* Filtro Categorías — colapsable, cerrado por defecto */}
      {categories.length > 0 && (
        <>
          <Divider />
          <SidebarSection title="Categoría" defaultOpen={false}>
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
                indent
              />
            ))}
          </SidebarSection>
        </>
      )}

      {/* Filtro Disponibilidad — cerrado por defecto */}
      <Divider />
      <SidebarSection title="Disponibilidad" defaultOpen={false}>
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
      </SidebarSection>
    </aside>
  )
}
