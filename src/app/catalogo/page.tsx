'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search,
  LayoutGrid,
  List,
  Mail,
  MessageCircle,
  SlidersHorizontal,
  Lock,
  ChevronDown,
} from 'lucide-react'
import type { CatalogProduct } from '@/types/database'
import clsx from 'clsx'

const ITEMS_PER_PAGE = 24

// ─── Sección colapsable del sidebar ──────────────────────────────────────────
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
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full mb-1.5 group"
      >
        <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide group-hover:text-brand-600 transition-colors">
          {title}
        </p>
        <ChevronDown
          size={12}
          className={clsx(
            'text-brand-300 group-hover:text-brand-500 transition-transform duration-200',
            open ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      {open && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  )
}

// ─── Tipos de estado de sesión ────────────────────────────────────────────────
type AuthState = {
  ready: boolean       // ¿ya terminó de verificar?
  loggedIn: boolean    // ¿hay sesión activa?
  isSuperAdmin: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CatalogoPage() {
  const supabase = createClient()

  // Auth
  const [auth, setAuth] = useState<AuthState>({
    ready: false,
    loggedIn: false,
    isSuperAdmin: false,
  })

  // Productos
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // UI
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')

  // Filtros
  const [filterBrand, setFilterBrand] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [filterOrg, setFilterOrg] = useState('')

  // Opciones de filtros
  const [brands, setBrands] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [orgs, setOrgs] = useState<string[]>([])

  // ── Verificar sesión UNA vez al montar, luego escuchar cambios ──────────────
  useEffect(() => {
    async function resolveRole(userId: string): Promise<boolean> {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      return data?.role === 'super_admin'
    }

    // Estado inicial
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAuth({ ready: true, loggedIn: false, isSuperAdmin: false })
      } else {
        const isSuper = await resolveRole(user.id)
        setAuth({ ready: true, loggedIn: true, isSuperAdmin: isSuper })
      }
    })

    // Cambios de sesión (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setAuth({ ready: true, loggedIn: false, isSuperAdmin: false })
        } else {
          const isSuper = await resolveRole(session.user.id)
          setAuth({ ready: true, loggedIn: true, isSuperAdmin: isSuper })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Cargar opciones de filtros ────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('catalog_view')
      .select('org_name, brand, category')
      .eq('status', 'active')
      .then(({ data }) => {
        if (!data) return
        setOrgs([...new Set(data.map((r) => r.org_name).filter(Boolean))] as string[])
        setBrands([...new Set(data.map((r) => r.brand).filter(Boolean))] as string[])
        setCats([...new Set(data.map((r) => r.category).filter(Boolean))] as string[])
      })
  }, [])

  // ── Fetch productos ───────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let q = supabase
      .from('catalog_view')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .range(from, to)
      .order('created_at', { ascending: false })

    if (search)
      q = q.or(
        `description.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`
      )
    if (filterOrg) q = q.eq('org_name', filterOrg)
    if (filterBrand) q = q.eq('brand', filterBrand)
    if (filterCat) q = q.eq('category', filterCat)
    if (filterStock === 'low') q = q.gt('stock_quantity', 0).lte('stock_quantity', 5)
    if (filterStock === 'ok') q = q.gt('stock_quantity', 5)

    const { data, count } = await q
    setProducts((data as CatalogProduct[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, filterOrg, filterBrand, filterCat, filterStock])

  useEffect(() => { setPage(1) }, [search, filterOrg, filterBrand, filterCat, filterStock])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── Contacto ──────────────────────────────────────────────────────────────
  function handleContact(p: CatalogProduct, channel: 'whatsapp' | 'email') {
    if (!auth.loggedIn) return

    if (channel === 'whatsapp' && p.contact_whatsapp) {
      const num = p.contact_whatsapp.replace(/\D/g, '')
      const msg = encodeURIComponent(
        `Hola! Te contacto desde Declavo por el siguiente producto:\n\n` +
          `• SKU: ${p.sku}\n• Descripción: ${p.description}\n• Marca: ${p.brand}\n\n¿Podés darme más información?`
      )
      window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
      return
    }

    if (channel === 'email' && p.contact_email) {
      const subject = encodeURIComponent(`Consulta de producto — ${p.sku} | Declavo`)
      const body = encodeURIComponent(buildEmailBody(p))
      window.open(`mailto:${p.contact_email}?subject=${subject}&body=${body}`, '_blank')
    }
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  function FilterBtn({
    active,
    onClick,
    label,
  }: {
    active: boolean
    onClick: () => void
    label: string
  }) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'text-left text-sm px-2 py-1.5 rounded-md transition-colors',
          active
            ? 'bg-brand-100 text-brand-900 font-medium'
            : 'text-brand-500 hover:bg-brand-50'
        )}
      >
        {label}
      </button>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full">
      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-brand-200 p-4 flex flex-col gap-4">

        {/* Filtro empresa: solo super_admin */}
        {auth.isSuperAdmin && (
          <>
            <SidebarSection title="Empresa">
              {['', ...orgs].map((o) => (
                <FilterBtn
                  key={o || '__all_orgs__'}
                  active={filterOrg === o}
                  onClick={() => setFilterOrg(o)}
                  label={o || 'Todas'}
                />
              ))}
            </SidebarSection>
            <div className="h-px bg-brand-200" />
          </>
        )}

        <SidebarSection title="Marca" defaultOpen>
          {['', ...brands].map((b) => (
            <FilterBtn
              key={b || '__all_brands__'}
              active={filterBrand === b}
              onClick={() => setFilterBrand(b)}
              label={b || 'Todas'}
            />
          ))}
        </SidebarSection>

        <div className="h-px bg-brand-200" />

        <SidebarSection title="Categoría" defaultOpen={false}>
          {['', ...cats].map((c) => (
            <FilterBtn
              key={c || '__all_cats__'}
              active={filterCat === c}
              onClick={() => setFilterCat(c)}
              label={c || 'Todas'}
            />
          ))}
        </SidebarSection>

        <div className="h-px bg-brand-200" />

        <SidebarSection title="Disponibilidad" defaultOpen={false}>
          {([['', 'Todos'], ['ok', 'Con stock'], ['low', 'Poco stock']] as const).map(
            ([val, label]) => (
              <FilterBtn
                key={val || '__all_stock__'}
                active={filterStock === val}
                onClick={() => setFilterStock(val)}
                label={label}
              />
            )
          )}
        </SidebarSection>

        {/* Aviso login — solo visible cuando auth ya resolvió y no hay sesión */}
        {auth.ready && !auth.loggedIn && (
          <>
            <div className="h-px bg-brand-200" />
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-center">
              <Lock size={14} className="mx-auto mb-1.5 text-brand-400" />
              <p className="text-[11px] text-brand-500 leading-snug">
                <a
                  href="/login"
                  className="font-medium text-brand-900 underline underline-offset-2"
                >
                  Iniciá sesión
                </a>{' '}
                para contactar vendedores
              </p>
            </div>
          </>
        )}
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400"
            />
            <input
              type="text"
              className="input pl-8"
              placeholder="Buscar por SKU, descripción o marca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-400">{total} productos</span>
            <div className="flex bg-brand-100 border border-brand-200 rounded-lg p-0.5 gap-0.5">
              {(['grid', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                    view === v
                      ? 'bg-white text-brand-900'
                      : 'text-brand-400 hover:text-brand-900'
                  )}
                >
                  {v === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-brand-400">Cargando productos…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <SlidersHorizontal size={32} className="mx-auto mb-3 text-brand-300" />
              <p className="text-sm font-medium text-brand-900 mb-1">Sin resultados</p>
              <p className="text-sm text-brand-400">
                Probá con otros filtros o términos de búsqueda.
              </p>
            </div>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onContact={handleContact}
                auth={auth}
              />
            ))}
          </div>
        ) : (
          /* Vista lista */
          <div className="card overflow-hidden">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="table-th" style={{ width: 130 }}>SKU</th>
                  <th className="table-th">Descripción</th>
                  <th className="table-th" style={{ width: 90 }}>Marca</th>
                  {auth.isSuperAdmin && (
                    <th className="table-th" style={{ width: 130 }}>Empresa</th>
                  )}
                  <th className="table-th" style={{ width: 70 }}>Stock</th>
                  <th className="table-th" style={{ width: 100, textAlign: 'right' }}>
                    Contacto
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="table-tr">
                    <td className="table-td font-mono text-[11px] text-brand-400 truncate">
                      {p.sku}
                    </td>
                    <td className="table-td font-medium truncate">{p.description}</td>
                    <td className="table-td text-brand-500">{p.brand}</td>
                    {auth.isSuperAdmin && (
                      <td className="table-td">
                        <span className="badge badge-gray">{p.org_name}</span>
                      </td>
                    )}
                    <td className="table-td font-mono">
                      <span
                        className={clsx(
                          'font-medium',
                          p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700'
                        )}
                      >
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="table-td">
                      {auth.loggedIn ? (
                        <div className="flex justify-end gap-1.5">
                          {p.contact_whatsapp && (
                            <button
                              onClick={() => handleContact(p, 'whatsapp')}
                              className="icon-btn"
                              title="Consultar por WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </button>
                          )}
                          {p.contact_email && (
                            <button
                              onClick={() => handleContact(p, 'email')}
                              className="icon-btn"
                              title="Consultar por Email"
                            >
                              <Mail size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <a
                            href="/login"
                            className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-900 transition-colors"
                          >
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

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-sm"
            >
              ←
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const n = i + 1
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={clsx(
                    'btn btn-sm w-8 justify-center',
                    page === n && 'btn-primary'
                  )}
                >
                  {n}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-sm"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Email profesional ────────────────────────────────────────────────────────
function buildEmailBody(p: CatalogProduct): string {
  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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

// ─── ProductCard ──────────────────────────────────────────────────────────────
function ProductCard({
  product: p,
  onContact,
  auth,
}: {
  product: CatalogProduct
  onContact: (p: CatalogProduct, ch: 'whatsapp' | 'email') => void
  auth: AuthState
}) {
  const hasContact = !!(p.contact_whatsapp || p.contact_email)

  return (
    <div className="card overflow-hidden hover:border-brand-300 transition-colors">
      <div className="h-28 bg-brand-50 border-b border-brand-200 flex items-center justify-center relative">
        <div className="w-12 h-12 bg-brand-200 rounded-lg opacity-40" />

        {/* Badge empresa: solo super_admin */}
        {auth.isSuperAdmin && (
          <span className="absolute top-2 left-2 badge badge-gray text-[10px]">
            {p.org_name}
          </span>
        )}

        <span
          className={clsx(
            'absolute top-2 right-2 badge',
            p.stock_quantity > 5 ? 'badge-green' : 'badge-amber'
          )}
        >
          {p.stock_quantity > 5 ? 'Stock OK' : `${p.stock_quantity} u.`}
        </span>
      </div>

      <div className="p-3">
        <p className="font-mono text-[10px] text-brand-400 mb-1">{p.sku}</p>
        <p className="text-sm font-medium leading-snug mb-1 line-clamp-2">
          {p.description}
        </p>
        <p className="text-xs text-brand-400 mb-3">
          {p.brand}
          {p.category ? ` · ${p.category}` : ''}
        </p>

        <div className="flex items-center justify-between border-t border-brand-100 pt-2.5">
          <span className="text-xs text-brand-400">
            Stock:{' '}
            <span
              className={clsx(
                'font-medium',
                p.stock_quantity <= 5 ? 'text-amber-700' : 'text-brand-900'
              )}
            >
              {p.stock_quantity} u.
            </span>
          </span>

          {auth.loggedIn ? (
            <div className="flex gap-1.5">
              {p.contact_whatsapp && (
                <button
                  onClick={() => onContact(p, 'whatsapp')}
                  className="icon-btn"
                  title="Consultar por WhatsApp"
                >
                  <MessageCircle size={13} />
                </button>
              )}
              {p.contact_email && (
                <button
                  onClick={() => onContact(p, 'email')}
                  className="icon-btn"
                  title="Consultar por Email"
                >
                  <Mail size={13} />
                </button>
              )}
            </div>
          ) : (
            /* Solo mostrar "Consultar" si hay datos de contacto en la org */
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
