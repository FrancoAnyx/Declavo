'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  LayoutGrid, Building2, Users, Mail, Package, Activity,
  Plus, Send, Pencil, Trash2, X, Check, Loader2, Copy
} from 'lucide-react'
import type { Organization, Profile, Product, Invitation } from '@/types/database'
import clsx from 'clsx'

type Section = 'overview' | 'empresas' | 'usuarios' | 'invitaciones' | 'productos'

export default function AdminPage() {
  const { user, loading: profileLoading } = useProfile()
  const [section, setSection] = useState<Section>('overview')

  if (profileLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
  if (user?.profile?.role !== 'super_admin') return <div className="p-8 text-center text-brand-400">Acceso denegado.</div>

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0 bg-white border-r border-brand-200 p-3 flex flex-col gap-1">
        <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide px-3 py-2">General</p>
        {([
          ['overview',     'Resumen',      <LayoutGrid size={14} />],
          ['empresas',     'Empresas',     <Building2 size={14} />],
          ['usuarios',     'Usuarios',     <Users size={14} />],
          ['invitaciones', 'Invitaciones', <Mail size={14} />],
        ] as [Section, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button key={id} onClick={() => setSection(id)} className={clsx('sidebar-item', section === id && 'sidebar-item-active')}>
            {icon}{label}
          </button>
        ))}
        <div className="h-px bg-brand-200 my-1" />
        <p className="text-[10px] font-medium text-brand-400 uppercase tracking-wide px-3 py-1">Catálogo</p>
        <button onClick={() => setSection('productos')} className={clsx('sidebar-item', section === 'productos' && 'sidebar-item-active')}>
          <Package size={14} />Productos
        </button>
      </aside>

      <div className="flex-1 p-6 overflow-x-hidden">
        {section === 'overview'     && <OverviewSection onNavigate={setSection} />}
        {section === 'empresas'     && <EmpresasSection />}
        {section === 'usuarios'     && <UsuariosSection />}
        {section === 'invitaciones' && <InvitacionesSection />}
        {section === 'productos'    && <ProductosSection />}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* OVERVIEW                                                   */
/* ────────────────────────────────────────────────────────── */
function OverviewSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const supabase = createClient()
  const [stats, setStats] = useState({ orgs: 0, products: 0, users: 0, invites: 0 })
  const [orgStats, setOrgStats] = useState<{ name: string; count: number }[]>([])

  useEffect(() => {
    async function load() {
      const [orgs, products, users, invites] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('invitations').select('*', { count: 'exact', head: true }).is('accepted_at', null).gt('expires_at', new Date().toISOString()),
      ])
      setStats({ orgs: orgs.count ?? 0, products: products.count ?? 0, users: users.count ?? 0, invites: invites.count ?? 0 })

      const { data } = await supabase.from('products').select('organization_id, organizations(name)').eq('status', 'active')
      if (data) {
        const counts: Record<string, { name: string; count: number }> = {}
        data.forEach((r: { organization_id: string; organizations: { name: string } | null }) => {
          const name = r.organizations?.name ?? r.organization_id
          if (!counts[r.organization_id]) counts[r.organization_id] = { name, count: 0 }
          counts[r.organization_id].count++
        })
        setOrgStats(Object.values(counts).sort((a, b) => b.count - a.count))
      }
    }
    load()
  }, [])

  const max = orgStats[0]?.count || 1

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Resumen</h1>
          <p className="text-sm text-brand-400 mt-0.5">Estado actual de Declavo</p>
        </div>
        <button onClick={() => onNavigate('invitaciones')} className="btn btn-primary"><Plus size={13} />Nueva invitación</button>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: 'Empresas activas',       value: stats.orgs },
          { label: 'Productos publicados',   value: stats.products },
          { label: 'Usuarios registrados',   value: stats.users },
          { label: 'Invitaciones pendientes',value: stats.invites },
        ].map(s => (
          <div key={s.label} className="bg-brand-100 rounded-lg p-3">
            <div className="text-2xl font-medium font-mono">{s.value}</div>
            <div className="text-xs text-brand-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium mb-4">Productos por empresa</p>
        <div className="flex flex-col gap-3">
          {orgStats.map(o => (
            <div key={o.name} className="flex items-center gap-3">
              <span className="text-xs text-brand-400 text-right w-32 truncate">{o.name}</span>
              <div className="flex-1 h-5 bg-brand-100 rounded overflow-hidden">
                <div className="h-full bg-brand-200 rounded flex items-center px-2" style={{ width: `${Math.round(o.count / max * 100)}%`, minWidth: 32 }}>
                  <span className="text-[11px] font-mono font-medium text-brand-600">{o.count}</span>
                </div>
              </div>
            </div>
          ))}
          {orgStats.length === 0 && <p className="text-sm text-brand-400">Sin datos aún.</p>}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* EMPRESAS                                                   */
/* ────────────────────────────────────────────────────────── */
function EmpresasSection() {
  const supabase = createClient()
  const [orgs, setOrgs]         = useState<Organization[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ name: '', legal_names: '', contact_email: '', contact_whatsapp: '' })
  const [error, setError]       = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase.from('organizations').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setOrgs((data as Organization[]) ?? []); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setError('')
    if (!form.name || !form.contact_email) { setError('Nombre y email son obligatorios.'); return }
    setSaving(true)
    const { error: e } = await supabase.from('organizations').insert({
      name: form.name.trim(),
      legal_names: form.legal_names.split('\n').map(s => s.trim()).filter(Boolean),
      contact_email: form.contact_email.trim(),
      contact_whatsapp: form.contact_whatsapp || null,
      is_active: true,
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setShowForm(false)
    setForm({ name: '', legal_names: '', contact_email: '', contact_whatsapp: '' })
    load()
  }

  async function handleToggle(org: Organization) {
    await supabase.from('organizations').update({ is_active: !org.is_active }).eq('id', org.id)
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Empresas</h1>
          <p className="text-sm text-brand-400 mt-0.5">Grupos y razones sociales</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary"><Plus size={13} />Nueva empresa</button>
      </div>

      {showForm && (
        <div className="card p-5 max-w-lg">
          <h2 className="text-sm font-medium mb-4">Nueva empresa</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Nombre del grupo *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="TechDistribuidora" /></div>
            <div className="col-span-2"><label className="label">Razones sociales (una por línea)</label><textarea className="input h-16 pt-2" value={form.legal_names} onChange={e => setForm(f => ({ ...f, legal_names: e.target.value }))} placeholder={'TechDistrib. SRL\nTechImport SA'} /></div>
            <div><label className="label">Email de contacto *</label><input type="email" className="input" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="admin@empresa.com" /></div>
            <div><label className="label">WhatsApp</label><input className="input" value={form.contact_whatsapp} onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))} placeholder="+549 11 0000-0000" /></div>
            {error && <p className="col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-brand-100">
            <button onClick={() => setShowForm(false)} className="btn">Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary">{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Crear empresa</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <div className="p-8 text-center"><Loader2 size={18} className="animate-spin text-brand-400 mx-auto" /></div> : (
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead><tr>
              <th className="table-th">Empresa</th>
              <th className="table-th" style={{ width: 180 }}>Razones sociales</th>
              <th className="table-th" style={{ width: 90 }}>Estado</th>
              <th className="table-th" style={{ width: 80, textAlign: 'right' }}>Acciones</th>
            </tr></thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id} className="table-tr">
                  <td className="table-td">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-brand-400">{o.contact_email}</div>
                  </td>
                  <td className="table-td text-xs text-brand-500">{o.legal_names?.join(', ') || '—'}</td>
                  <td className="table-td"><span className={clsx('badge', o.is_active ? 'badge-green' : 'badge-gray')}>{o.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="table-td"><div className="flex justify-end gap-1">
                    <button onClick={() => handleToggle(o)} className="icon-btn" title={o.is_active ? 'Desactivar' : 'Activar'}>
                      {o.is_active ? <X size={12} /> : <Check size={12} />}
                    </button>
                  </div></td>
                </tr>
              ))}
              {orgs.length === 0 && <tr><td colSpan={4} className="table-td text-center text-brand-400 py-8">Sin empresas aún.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* USUARIOS                                                   */
/* ────────────────────────────────────────────────────────── */
function UsuariosSection() {
  const supabase = createClient()
  const [users, setUsers]   = useState<(Profile & { org_name?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false })
      setUsers((data ?? []).map((u: Profile & { organizations: { name: string } | null }) => ({ ...u, org_name: u.organizations?.name ?? '—' })))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-medium">Usuarios</h1><p className="text-sm text-brand-400 mt-0.5">Todos los usuarios de la plataforma</p></div>
      <div className="card overflow-hidden">
        {loading ? <div className="p-8 text-center"><Loader2 size={18} className="animate-spin text-brand-400 mx-auto" /></div> : (
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead><tr>
              <th className="table-th">Usuario</th>
              <th className="table-th">Empresa</th>
              <th className="table-th" style={{ width: 110 }}>Rol</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="table-tr">
                  <td className="table-td">
                    <div className="font-medium">{u.full_name || 'Sin nombre'}</div>
                    <div className="text-xs text-brand-400 font-mono">{u.id.slice(0, 8)}…</div>
                  </td>
                  <td className="table-td text-brand-500">{(u as Profile & { org_name?: string }).org_name}</td>
                  <td className="table-td">
                    <span className={clsx('badge', u.role === 'super_admin' ? 'badge-red' : u.role === 'org_admin' ? 'badge-purple' : 'badge-gray')}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="table-td text-center text-brand-400 py-8">Sin usuarios aún.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* INVITACIONES                                               */
/* ────────────────────────────────────────────────────────── */
function InvitacionesSection() {
  const supabase = createClient()
  const { user } = useProfile()
  const [invitations, setInvitations] = useState<(Invitation & { org_name?: string })[]>([])
  const [orgs, setOrgs]               = useState<Organization[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'pending' | 'accepted' | 'expired'>('pending')
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [copied, setCopied]           = useState<string | null>(null)
  const [form, setForm]               = useState({ email: '', org_id: '', role: 'member' as 'org_admin' | 'member', expires_days: '7' })
  const [error, setError]             = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase.from('invitations').select('*, organizations(name)').order('created_at', { ascending: false })
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInvitations((data ?? []).map((i: any) => ({ ...i, org_name: i.organizations?.name ?? '—' })))
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    supabase.from('organizations').select('id,name').eq('is_active', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setOrgs((data ?? []) as any))
  }, [load])

  async function handleCreate() {
    setError('')
    if (!form.email || !form.org_id) { setError('Email y empresa son obligatorios.'); return }
    setSaving(true)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + Number(form.expires_days))
    const { error: e } = await supabase.from('invitations').insert({
      email: form.email.trim(),
      organization_id: form.org_id,
      role: form.role,
      expires_at: expiresAt.toISOString(),
      invited_by: user?.id ?? null,
    })
    setSaving(false)
    if (e) { setError(e.message); return }
    setShowForm(false)
    setForm({ email: '', org_id: '', role: 'member', expires_days: '7' })
    load()
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta invitación?')) return
    await supabase.from('invitations').delete().eq('id', id)
    load()
  }

  function handleCopy(token: string) {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const now    = new Date()
  const pending  = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) > now)
  const accepted = invitations.filter(i => i.accepted_at)
  const expired  = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) <= now)
  const shown    = tab === 'pending' ? pending : tab === 'accepted' ? accepted : expired

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div><h1 className="text-xl font-medium">Invitaciones</h1><p className="text-sm text-brand-400 mt-0.5">Sistema de acceso cerrado</p></div>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary"><Plus size={13} />Enviar invitación</button>
      </div>

      {showForm && (
        <div className="card p-5 max-w-lg">
          <h2 className="text-sm font-medium mb-4">Nueva invitación</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com" /></div>
            <div><label className="label">Empresa *</label>
              <select className="input" value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))}>
                <option value="">Seleccionar…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div><label className="label">Rol</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'org_admin' | 'member' }))}>
                <option value="member">member</option>
                <option value="org_admin">org_admin</option>
              </select>
            </div>
            <div><label className="label">Expira en</label>
              <select className="input" value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}>
                <option value="1">24 horas</option>
                <option value="3">3 días</option>
                <option value="7">7 días</option>
                <option value="30">30 días</option>
              </select>
            </div>
            {error && <p className="col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-brand-100">
            <button onClick={() => setShowForm(false)} className="btn">Cancelar</button>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary">{saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}Generar link</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-brand-100 border border-brand-200 rounded-lg p-1 w-fit">
        {([['pending', `Pendientes (${pending.length})`], ['accepted', `Aceptadas (${accepted.length})`], ['expired', `Expiradas (${expired.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tab === id ? 'bg-white text-brand-900' : 'text-brand-400 hover:text-brand-900')}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><Loader2 size={18} className="animate-spin text-brand-400" /></div> : (
        <>
          {tab === 'pending' && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {shown.map(inv => (
                <div key={inv.id} className="card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-xs text-brand-400 mt-0.5">{inv.org_name} · <span className="badge badge-gray">{inv.role}</span></p>
                    </div>
                    <span className="badge badge-amber flex-shrink-0">Pendiente</span>
                  </div>
                  <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 gap-2">
                    <span className="font-mono text-[10px] text-brand-400 truncate">{inv.token.slice(0, 20)}…</span>
                    <button onClick={() => handleCopy(inv.token)} className="text-xs text-brand-400 hover:text-brand-900 flex items-center gap-1 flex-shrink-0">
                      {copied === inv.token ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                      {copied === inv.token ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-brand-400">Expira {new Date(inv.expires_at).toLocaleDateString('es-AR')}</span>
                    <button onClick={() => handleRevoke(inv.id)} className="btn btn-sm btn-danger">Revocar</button>
                  </div>
                </div>
              ))}
              {shown.length === 0 && <p className="text-sm text-brand-400">Sin invitaciones pendientes.</p>}
            </div>
          )}
          {tab !== 'pending' && (
            <div className="card overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead><tr>
                  <th className="table-th">Email</th>
                  <th className="table-th" style={{ width: 150 }}>Empresa</th>
                  <th className="table-th" style={{ width: 100 }}>Rol</th>
                  <th className="table-th" style={{ width: 130 }}>{tab === 'accepted' ? 'Aceptada' : 'Expiró'}</th>
                </tr></thead>
                <tbody>
                  {shown.map(inv => (
                    <tr key={inv.id} className="table-tr">
                      <td className="table-td truncate">{inv.email}</td>
                      <td className="table-td">{inv.org_name}</td>
                      <td className="table-td"><span className="badge badge-gray">{inv.role}</span></td>
                      <td className="table-td text-xs text-brand-400">{new Date(tab === 'accepted' ? inv.accepted_at! : inv.expires_at).toLocaleDateString('es-AR')}</td>
                    </tr>
                  ))}
                  {shown.length === 0 && <tr><td colSpan={4} className="table-td text-center text-brand-400 py-8">Sin registros.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* PRODUCTOS (admin global view)                              */
/* ────────────────────────────────────────────────────────── */
function ProductosSection() {
  const supabase = createClient()
  const [products, setProducts] = useState<(Product & { org_name?: string })[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const load = useCallback(() => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (search) query = query.or(`description.ilike.%${search}%,sku.ilike.%${search}%`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query.then(({ data }) => { setProducts((data ?? []).map((p: any) => ({ ...p, org_name: p.organizations?.name ?? '—' }))); setLoading(false) })
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto permanentemente?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-medium">Productos</h1><p className="text-sm text-brand-400 mt-0.5">Vista global — podés dar de baja cualquier publicación</p></div>
      <div className="relative max-w-sm">
        <Activity size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
        <input type="text" className="input pl-8" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="p-8 text-center"><Loader2 size={18} className="animate-spin text-brand-400 mx-auto" /></div> : (
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead><tr>
              <th className="table-th" style={{ width: 130 }}>SKU</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" style={{ width: 90 }}>Marca</th>
              <th className="table-th" style={{ width: 140 }}>Empresa</th>
              <th className="table-th" style={{ width: 70 }}>Stock</th>
              <th className="table-th" style={{ width: 80 }}>Estado</th>
              <th className="table-th" style={{ width: 60, textAlign: 'right' }}>Acc.</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td font-mono text-[11px] text-brand-400 truncate">{p.sku}</td>
                  <td className="table-td font-medium truncate">{p.description}</td>
                  <td className="table-td text-brand-500">{p.brand}</td>
                  <td className="table-td"><span className="badge badge-gray">{p.org_name}</span></td>
                  <td className={clsx('table-td font-mono font-medium', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700')}>{p.stock_quantity}</td>
                  <td className="table-td"><span className={clsx('badge', p.status === 'active' ? 'badge-green' : 'badge-amber')}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span></td>
                  <td className="table-td"><div className="flex justify-end"><button onClick={() => handleDelete(p.id)} className="icon-btn icon-btn-danger"><Trash2 size={12} /></button></div></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={7} className="table-td text-center text-brand-400 py-8">Sin productos.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
