'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import CatalogoSidebar from '@/components/CatalogoSidebar'
import ProductCard, { type CatalogProduct } from '@/components/ProductCard'
import GuestBanner from '@/components/GuestBanner'
import { useProfile } from '@/context/ProfileContext'

const SIDEBAR_W = 240

function SearchIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function GridIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function ListIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.5px', lineHeight: 1, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function AvailBadge({ qty }: { qty: number }) {
  const q = Number(qty)
  if (q > 5)  return <span className="badge-success">● Disponible</span>
  if (q > 0)  return <span className="badge-warning">● Stock bajo</span>
  return             <span className="badge-danger">● Sin stock</span>
}

function ProductTable({ products, showOrg, isLoggedIn }: { products: CatalogProduct[]; showOrg: boolean; isLoggedIn: boolean }) {
  const handleWA    = (p: CatalogProduct) => { if (!p.contact_whatsapp) return; window.open(`https://wa.me/${p.contact_whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, vi "${p.description}" en Declavo.`)}`, '_blank') }
  const handleEmail = (p: CatalogProduct) => { if (!p.contact_email) return; window.location.href = `mailto:${p.contact_email}?subject=Consulta Declavo: ${p.sku}` }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="data-table">
        <thead><tr>
          <th>SKU</th><th>Descripción</th><th>Marca</th><th>Categoría</th><th>Stock</th><th>Estado</th>
          {showOrg && <th>Empresa</th>}
          {isLoggedIn && <th>Contacto</th>}
        </tr></thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td><span style={{ fontFamily: 'Syne,sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{p.sku}</span></td>
              <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 260 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</span></td>
              <td><span className="badge-accent">{p.brand}</span></td>
              <td style={{ color: 'var(--text-muted)' }}>{p.category ?? '—'}</td>
              <td>{p.stock_quantity}</td>
              <td><AvailBadge qty={Number(p.stock_quantity)} /></td>
              {showOrg && <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.org_name ?? '—'}</td>}
              {isLoggedIn && (
                <td><div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-wa" style={{ flex: 'none', padding: '4px 10px', fontSize: 11 }} onClick={() => handleWA(p)} disabled={!p.contact_whatsapp}>WA</button>
                  <button className="btn-email" style={{ flex: 'none', padding: '4px 10px', fontSize: 11 }} onClick={() => handleEmail(p)} disabled={!p.contact_email}>✉</button>
                </div></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CatalogoPage() {
  const supabase     = createClient()
  const { user }     = useProfile()
  const role         = user?.profile?.role ?? null
  const isLoggedIn   = !!user?.profile
  const isSuperAdmin = role === 'super_admin'
  // org_admin y super_admin pueden ir a Mis Productos; member solo ve el catálogo
  const canManageProducts = role === 'super_admin' || role === 'org_admin'

  const [products, setProducts]             = useState<CatalogProduct[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [view, setView]                     = useState<'grid' | 'list'>('grid')
  const [selectedBrand, setSelectedBrand]   = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedAvail, setSelectedAvail]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase.from('catalog_view').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { if (!cancelled && data) setProducts(data as CatalogProduct[]); if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!search.trim()) {
      supabase.from('catalog_view').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(500)
        .then(({ data }) => { if (data) setProducts(data as CatalogProduct[]) })
      return
    }
    const t = setTimeout(() => {
      // La función se llama con search_term (NO query)
      supabase.rpc('search_catalog', { search_term: search.trim() })
        .then(({ data }) => { if (data) setProducts(data as CatalogProduct[]) })
    }, 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const brands     = useMemo(() => [...new Set(products.map(p => p.brand))].sort(), [products])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort() as string[], [products])

  const filtered = useMemo(() => products.filter(p => {
    if (selectedBrand    && p.brand !== selectedBrand) return false
    if (selectedCategory && p.category !== selectedCategory) return false
    const q = Number(p.stock_quantity)
    if (selectedAvail === 'instock'  && q <= 5)             return false
    if (selectedAvail === 'lowstock' && (q === 0 || q > 5)) return false
    if (selectedAvail === 'nostock'  && q > 0)              return false
    return true
  }), [products, selectedBrand, selectedCategory, selectedAvail])

  const totalBrands = useMemo(() => new Set(products.map(p => p.brand)).size, [products])
  const totalOrgs   = useMemo(() => new Set(products.map(p => p.organization_id)).size, [products])

  return (
    <>
      <div className="bg-orb" style={{ width: 360, height: 360, background: 'var(--accent)', top: -80, right: '8%' }} />
      <div className="bg-orb" style={{ width: 280, height: 280, background: 'var(--accent3)', bottom: '15%', left: '3%' }} />

      <CatalogoSidebar
        brands={brands} categories={categories}
        selectedBrand={selectedBrand} selectedCategory={selectedCategory} selectedAvail={selectedAvail}
        onBrand={setSelectedBrand} onCategory={setSelectedCategory} onAvail={setSelectedAvail}
      />

      <main style={{ marginLeft: SIDEBAR_W, paddingTop: 64, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 60px' }}>

          {/* Banner solo para visitantes sin sesión */}
          {!isLoggedIn && <GuestBanner />}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-0.3px', color: 'var(--text-primary)', margin: 0 }}>Catálogo General</h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>Stock disponible de todas las empresas del ecosistema</p>
            </div>
            {/* Botones solo para roles que pueden gestionar productos */}
            {canManageProducts && (
              <div style={{ display: 'flex', gap: 8 }}>
                <a href="/mis-productos" className="btn-ghost">⬆ Importar Excel</a>
                <a href="/mis-productos" className="btn-primary">＋ Publicar</a>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
            <StatCard label="Productos activos" value={products.length} />
            <StatCard label="Empresas" value={totalOrgs} />
            <StatCard label="Marcas" value={totalBrands} />
            <StatCard label="Mostrando" value={filtered.length} sub={filtered.length !== products.length ? 'con filtros' : undefined} />
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}><SearchIcon /></span>
              <input className="input" style={{ paddingLeft: 34 }} type="text" placeholder="Buscar SKU, descripción, marca…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className={`filter-chip${!selectedCategory ? ' active' : ''}`} onClick={() => setSelectedCategory(null)}>Todos</button>
            {categories.slice(0, 4).map(cat => (
              <button key={cat} className={`filter-chip${selectedCategory === cat ? ' active' : ''}`} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}>{cat}</button>
            ))}
            <div style={{ display: 'flex', marginLeft: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {(['grid', 'list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} title={v === 'grid' ? 'Vista grilla' : 'Vista lista'}
                  style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: view === v ? 'var(--accent-glow)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.18s' }}>
                  {v === 'grid' ? <GridIcon /> : <ListIcon />}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
              <p style={{ fontSize: 14 }}>Cargando catálogo…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 6 }}>Sin resultados</h3>
              <p style={{ fontSize: 14 }}>Probá con otros filtros o términos de búsqueda</p>
            </div>
          ) : view === 'grid' ? (
            <div className="stagger" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))' }}>
              {filtered.map(p => <ProductCard key={p.id} product={p} showOrg={isSuperAdmin} />)}
            </div>
          ) : (
            <ProductTable products={filtered} showOrg={isSuperAdmin} isLoggedIn={isLoggedIn} />
          )}
        </div>
      </main>
    </>
  )
}
