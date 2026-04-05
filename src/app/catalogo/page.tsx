'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, LayoutGrid, List, Mail, MessageCircle, SlidersHorizontal, Lock } from 'lucide-react'
import type { CatalogProduct } from '@/types/database'
import clsx from 'clsx'

const ITEMS_PER_PAGE = 24

export default function CatalogoPage() {
  const supabase = createClient()

  const [products, setProducts]       = useState<CatalogProduct[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const [search, setSearch]           = useState('')
  const [filterOrg, setFilterOrg]     = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterCat, setFilterCat]     = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const [orgs, setOrgs]               = useState<string[]>([])
  const [brands, setBrands]           = useState<string[]>([])
  const [cats, setCats]               = useState<string[]>([])

  // Estado de sesión del visitante
  const [isLoggedIn, setIsLoggedIn]   = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Verificar si hay sesión activa (sin redirigir si no la hay)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * ITEMS_PER_PAGE
    const to   = from + ITEMS_PER_PAGE - 1

    let query = supabase
      .from('catalog_view')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .range(from, to)
      .order('created_at', { ascending: false })

    if (search)      query = query.or(`description.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`)
    if (filterOrg)   query = query.eq('org_name', filterOrg)
    if (filterBrand) query = query.eq('brand', filterBrand)
    if (filterCat)   query = query.eq('category', filterCat)
    if (filterStock === 'low')  query = query.gt('stock_quantity', 0).lte('stock_quantity', 5)
    if (filterStock === 'ok')   query = query.gt('stock_quantity', 5)

    const { data, count } = await query
    setProducts((data as CatalogProduct[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterOrg, filterBrand, filterCat, filterStock, page])

  // Load filter options once
  useEffect(() => {
    async function loadFilters() {
      const { data } = await supabase.from('catalog_view').select('org_name, brand, category').eq('status', 'active')
      if (!data) return
      setOrgs([...new Set(data.map(r => r.org_name).filter(Boolean))] as string[])
      setBrands([...new Set(data.map(r => r.brand).filter(Boolean))] as string[])
      setCats([...new Set(data.map(r => r.category).filter(Boolean))] as string[])
    }
    loadFilters()
  }, [])

  useEffect(() => { setPage(1) }, [search, filterOrg, filterBrand, filterCat, filterStock])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  function handleContact(p: CatalogProduct, channel: 'whatsapp' | 'email') {
    if (!isLoggedIn) return

    if (channel === 'whatsapp' && p.contact_whatsapp) {
      const num = p.contact_whatsapp.replace(/\D/g, '')
      const msg = encodeURIComponent(
        `Hola! Te contacto desde Declavo por el siguiente producto:\n\n` +
        `• SKU: ${p.sku}\n` +
        `• Descripción: ${p.description}\n` +
        `• Marca: ${p.brand}\n\n` +
        `¿Podés darme más información?`
      )
      window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
    } else if (channel === 'email' && p.contact_email) {
      const subject = encodeURIComponent(`Consulta de producto — ${p.sku} | Declavo`)
      const body = encodeURIComponent(buildEmailBody(p))
      window.open(`mailto:${p.contact_email}?subject=${subject}&body=${body}`, '_blank')
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="flex min-h-full">
      {/* Sidebar filtros */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-brand-200 p-4 flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide mb-2">Empresa</p>
          <div className="flex flex-col gap-0.5">
            {['', ...orgs].map(o => (
              <button
                key={o}
                onClick={() => setFilterOrg(o)}
                className={clsx('text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                  filterOrg === o ? 'bg-brand-100 text-brand-900 font-medium' : 'text-brand-500 hover:bg-brand-50'
                )}
              >
                {o || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-brand-200" />

        <div>
          <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide mb-2">Marca</p>
          <div className="flex flex-col gap-0.5">
            {['', ...brands].map(b => (
              <button
                key={b}
                onClick={() => setFilterBrand(b)}
                className={clsx('text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                  filterBrand === b ? 'bg-brand-100 text-brand-900 font-medium' : 'text-brand-500 hover:bg-brand-50'
                )}
              >
                {b || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-brand-200" />

        <div>
          <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide mb-2">Categoría</p>
          <div className="flex flex-col gap-0.5">
            {['', ...cats].map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={clsx('text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                  filterCat === c ? 'bg-brand-100 text-brand-900 font-medium' : 'text-brand-500 hover:bg-brand-50'
                )}
              >
                {c || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-brand-200" />

        <div>
          <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide mb-2">Disponibilidad</p>
          <div className="flex flex-col gap-0.5">
            {[['', 'Todos'], ['ok', 'Con stock'], ['low', 'Poco stock']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStock(val)}
                className={clsx('text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                  filterStock === val ? 'bg-brand-100 text-brand-900 font-medium' : 'text-brand-500 hover:bg-brand-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Aviso de sesión para visitantes */}
        {authChecked && !isLoggedIn && (
          <>
            <div className="h-px bg-brand-200" />
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-center">
              <Lock size={14} className="mx-auto mb-1.5 text-brand-400" />
              <p className="text-[11px] text-brand-500 leading-snug">
                <a href="/login" className="font-medium text-brand-900 underline underline-offset-2">Iniciá sesión</a>
                {' '}para contactar vendedores
              </p>
            </div>
          </>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              type="text"
              className="input pl-8"
              placeholder="Buscar por SKU, descripción o marca…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-400">{total} productos</span>
            <div className="flex bg-brand-100 border border-brand-200 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setView('grid')} className={clsx('w-7 h-7 rounded-md flex items-center justify-center transition-colors', view === 'grid' ? 'bg-white text-brand-900' : 'text-brand-400 hover:text-brand-900')}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setView('list')} className={clsx('w-7 h-7 rounded-md flex items-center justify-center transition-colors', view === 'list' ? 'bg-white text-brand-900' : 'text-brand-400 hover:text-brand-900')}>
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-brand-400">Cargando productos…</div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <SlidersHorizontal size={32} className="mx-auto mb-3 text-brand-300" />
              <p className="text-sm font-medium text-brand-900 mb-1">Sin resultados</p>
              <p className="text-sm text-brand-400">Probá con otros filtros o términos de búsqueda.</p>
            </div>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {products.map(p => (
              <ProductCard key={p.id} product={p} onContact={handleContact} isLoggedIn={isLoggedIn} />
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="table-th" style={{ width: 130 }}>SKU</th>
                  <th className="table-th">Descripción</th>
                  <th className="table-th" style={{ width: 90 }}>Marca</th>
                  <th className="table-th" style={{ width: 130 }}>Empresa</th>
                  <th className="table-th" style={{ width: 70 }}>Stock</th>
                  <th className="table-th" style={{ width: 90, textAlign: 'right' }}>Contacto</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="table-tr">
                    <td className="table-td font-mono text-[11px] text-brand-400 truncate">{p.sku}</td>
                    <td className="table-td font-medium truncate">{p.description}</td>
                    <td className="table-td text-brand-500">{p.brand}</td>
                    <td className="table-td">
                      <span className="badge badge-gray">{p.org_name}</span>
                    </td>
                    <td className="table-td font-mono">
                      <span className={clsx('font-medium', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700')}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="table-td">
                      {isLoggedIn ? (
                        <div className="flex justify-end gap-1.5">
                          {p.contact_whatsapp && (
                            <button onClick={() => handleContact(p, 'whatsapp')} className="icon-btn" title="Consultar por WhatsApp">
                              <MessageCircle size={13} />
                            </button>
                          )}
                          {p.contact_email && (
                            <button onClick={() => handleContact(p, 'email')} className="icon-btn" title="Consultar por Email">
                              <Mail size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <a href="/login" className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-900 transition-colors" title="Iniciá sesión para consultar">
                            <Lock size={11} />
                            <span>Ingresar</span>
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm">←</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1
              return (
                <button key={p} onClick={() => setPage(p)} className={clsx('btn btn-sm w-8 justify-center', page === p && 'btn-primary')}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm">→</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────── */
/* Construye el cuerpo del email profesional    */
/* ──────────────────────────────────────────── */
function buildEmailBody(p: CatalogProduct): string {
  const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Buenos días,

Me comunico con ustedes a través de Declavo en relación al siguiente producto publicado en la plataforma:

──────────────────────────────────────
DETALLE DEL PRODUCTO
──────────────────────────────────────
SKU:          ${p.sku}
Descripción:  ${p.description}
Marca:        ${p.brand}${p.category ? `\nCategoría:    ${p.category}` : ''}
Stock actual: ${p.stock_quantity} unidades
──────────────────────────────────────

Quisiera obtener más información sobre disponibilidad, condiciones comerciales y plazos de entrega.

Quedo a disposición para coordinar según su conveniencia.

Saludos cordiales,

─────────────────────────
Enviado desde Declavo
Plataforma de visibilidad de stock entre colegas del rubro tecnológico
${today}
─────────────────────────`
}

/* ──────────────────────────────────────────── */
/* ProductCard                                  */
/* ──────────────────────────────────────────── */
function ProductCard({
  product: p,
  onContact,
  isLoggedIn,
}: {
  product: CatalogProduct
  onContact: (p: CatalogProduct, ch: 'whatsapp' | 'email') => void
  isLoggedIn: boolean
}) {
  const hasContact = p.contact_whatsapp || p.contact_email

  return (
    <div className="card overflow-hidden hover:border-brand-300 transition-colors">
      {/* Image placeholder */}
      <div className="h-28 bg-brand-50 border-b border-brand-200 flex items-center justify-center relative">
        <div className="w-12 h-12 bg-brand-200 rounded-lg opacity-40" />
        <span className="absolute top-2 left-2 badge badge-gray text-[10px]">{p.org_name}</span>
        <span className={clsx('absolute top-2 right-2 badge', p.stock_quantity > 5 ? 'badge-green' : 'badge-amber')}>
          {p.stock_quantity > 5 ? 'Stock OK' : `${p.stock_quantity} u.`}
        </span>
      </div>

      <div className="p-3">
        <p className="font-mono text-[10px] text-brand-400 mb-1">{p.sku}</p>
        <p className="text-sm font-medium leading-snug mb-1 line-clamp-2">{p.description}</p>
        <p className="text-xs text-brand-400 mb-3">{p.brand}{p.category ? ` · ${p.category}` : ''}</p>

        <div className="flex items-center justify-between border-t border-brand-100 pt-2.5">
          <span className="text-xs text-brand-400">
            Stock: <span className={clsx('font-medium', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-brand-900')}>{p.stock_quantity} u.</span>
          </span>

          {isLoggedIn ? (
            /* Usuario logueado: muestra botones de contacto */
            <div className="flex gap-1.5">
              {p.contact_whatsapp && (
                <button onClick={() => onContact(p, 'whatsapp')} className="icon-btn" title="Consultar por WhatsApp">
                  <MessageCircle size={13} />
                </button>
              )}
              {p.contact_email && (
                <button onClick={() => onContact(p, 'email')} className="icon-btn" title="Consultar por Email">
                  <Mail size={13} />
                </button>
              )}
            </div>
          ) : (
            /* Visitante sin sesión: invitación a ingresar */
            hasContact && (
              <a
                href="/login"
                className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-900 transition-colors"
                title="Iniciá sesión para consultar"
              >
                <Lock size={11} />
                <span>Consultar</span>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  )
}
