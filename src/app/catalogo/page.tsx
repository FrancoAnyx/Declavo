'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Navbar from '@/components/Navbar'
import CatalogoSidebar from '@/components/CatalogoSidebar'
import ProductCard, { type CatalogProduct } from '@/components/ProductCard'
import { useProfile } from '@/context/ProfileContext'

const SIDEBAR_W = 240
const PAGE_SIZE = 24

// Ícono lupa
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
// Ícono grilla / lista
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function ListIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
}

// Stat card pequeño
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card transition-all duration-200">
      <div className="text-xs font-bold tracking-wider uppercase mb-2.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="font-display font-bold text-3xl tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// Tabla de lista
function ProductTable({ products, showOrg }: { products: CatalogProduct[]; showOrg: boolean }) {
  function AvailBadge({ qty }: { qty: number }) {
    if (qty > 5) return <span className="badge-success">● Disponible</span>
    if (qty > 0) return <span className="badge-warning">● Stock bajo</span>
    return             <span className="badge-danger">● Sin stock</span>
  }

  const handleWA = (p: CatalogProduct) => {
    if (!p.contact_whatsapp) return
    const num = p.contact_whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(`Hola, vi "${p.description}" en Declavo y me interesa.`)
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
  }

  const handleEmail = (p: CatalogProduct) => {
    if (!p.contact_email) return
    window.location.href = `mailto:${p.contact_email}?subject=Consulta Declavo: ${p.sku}`
  }

  return (
    <div className="card overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Descripción</th>
            <th>Marca</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>Estado</th>
            {showOrg && <th>Empresa</th>}
            <th>Contacto</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>
                <span className="font-display text-xs font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {p.sku}
                </span>
              </td>
              <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 280 }}>
                <span className="line-clamp-1">{p.description}</span>
              </td>
              <td><span className="badge-accent">{p.brand}</span></td>
              <td>{p.category ?? '—'}</td>
              <td>{p.stock_quantity}</td>
              <td><AvailBadge qty={Number(p.stock_quantity)} /></td>
              {showOrg && <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.organization_name ?? '—'}</td>}
              <td>
                <div className="flex gap-1.5">
                  <button className="btn-wa" style={{ flex: 'none', padding: '4px 10px', fontSize: 11 }} onClick={() => handleWA(p)}>WA</button>
                  <button className="btn-email" style={{ flex: 'none', padding: '4px 10px', fontSize: 11 }} onClick={() => handleEmail(p)}>✉</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CatalogoPage() {
  const supabase = createClientComponentClient()
  const { profile } = useProfile()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [products, setProducts]       = useState<CatalogProduct[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const [selectedBrand, setSelectedBrand]       = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedAvail, setSelectedAvail]       = useState<string | null>(null)

  // Cargar productos
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('catalog_view')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && data) setProducts(data as CatalogProduct[])
      setLoading(false)
    }
    load()
  }, [supabase])

  // Búsqueda full-text via RPC cuando hay texto
  useEffect(() => {
    if (!search.trim()) return
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .rpc('search_catalog', { query: search.trim() })
      if (data) setProducts(data as CatalogProduct[])
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, supabase])

  // Volver a cargar sin búsqueda si se borra el texto
  useEffect(() => {
    if (search.trim()) return
    supabase
      .from('catalog_view')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { if (data) setProducts(data as CatalogProduct[]) })
  }, [search, supabase])

  // Extraer opciones de filtros
  const brands     = useMemo(() => [...new Set(products.map(p => p.brand))].sort(), [products])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort() as string[], [products])

  // Filtrado local
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (selectedBrand && p.brand !== selectedBrand) return false
      if (selectedCategory && p.category !== selectedCategory) return false
      if (selectedAvail === 'instock'  && Number(p.stock_quantity) <= 5) return false
      if (selectedAvail === 'lowstock' && (Number(p.stock_quantity) === 0 || Number(p.stock_quantity) > 5)) return false
      if (selectedAvail === 'nostock'  && Number(p.stock_quantity) > 0) return false
      return true
    })
  }, [products, selectedBrand, selectedCategory, selectedAvail])

  // Stats
  const totalBrands = useMemo(() => new Set(products.map(p => p.brand)).size, [products])
  const totalOrgs   = useMemo(() => new Set(products.map((p: any) => p.organization_id)).size, [products])

  return (
    <>
      {/* Orbs decorativos */}
      <div className="bg-orb" style={{ width: 400, height: 400, background: 'var(--accent)', top: -100, right: '10%' }} />
      <div className="bg-orb" style={{ width: 300, height: 300, background: 'var(--accent3)', bottom: '20%', left: '5%' }} />

      <Navbar />

      <CatalogoSidebar
        brands={brands}
        categories={categories}
        selectedBrand={selectedBrand}
        selectedCategory={selectedCategory}
        selectedAvail={selectedAvail}
        onBrand={setSelectedBrand}
        onCategory={setSelectedCategory}
        onAvail={setSelectedAvail}
      />

      {/* Main */}
      <main
        className="relative z-10"
        style={{
          marginLeft: SIDEBAR_W,
          paddingTop: 64 + 28,
          padding: `${64 + 28}px 28px 60px`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Catálogo General
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Stock disponible de todas las empresas del ecosistema
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/mis-productos" className="btn-ghost no-underline">
              ⬆ Importar Excel
            </a>
            <a href="/mis-productos?new=1" className="btn-primary no-underline">
              ＋ Publicar producto
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Productos activos" value={products.length} sub="en el catálogo" />
          <StatCard label="Empresas" value={totalOrgs} sub="participando en la red" />
          <StatCard label="Marcas" value={totalBrands} sub="en el ecosistema" />
          <StatCard label="Mostrando" value={filtered.length} sub={filtered.length !== products.length ? 'con filtros activos' : 'todos los productos'} />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <SearchIcon />
            </span>
            <input
              className="input pl-9"
              type="text"
              placeholder="Buscar SKU, descripción, marca…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Chips de categoría rápidos */}
          <button
            className={`filter-chip ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </button>
          {categories.slice(0, 4).map(cat => (
            <button
              key={cat}
              className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {cat}
            </button>
          ))}

          {/* View toggle */}
          <div
            className="flex ml-auto rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {(['grid', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 38, height: 38,
                  background: view === v ? 'var(--accent-glow)' : 'transparent',
                  color: view === v ? 'var(--accent)' : 'var(--text-muted)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {v === 'grid' ? <GridIcon /> : <ListIcon />}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-sm">Cargando catálogo…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            <div className="text-5xl mb-3">📭</div>
            <h3 className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text-secondary)' }}>
              Sin resultados
            </h3>
            <p className="text-sm">Probá con otros filtros o términos de búsqueda</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} showOrg={isSuperAdmin} />
            ))}
          </div>
        ) : (
          <ProductTable products={filtered} showOrg={isSuperAdmin} />
        )}
      </main>
    </>
  )
}
