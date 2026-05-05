'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  LayoutGrid, Building2, Users, Mail, Package,
  Plus, Send, X, Check, Loader2, Copy, Pencil, Inbox, MessageSquare,
} from 'lucide-react'
import type { Organization, Profile, Invitation, AccessRequest } from '@/types/database'
import clsx from 'clsx'

type Section = 'overview' | 'empresas' | 'usuarios' | 'invitaciones' | 'productos' | 'solicitudes' | 'chats'

/* ── Estilos inline temáticos (sin bg-white hardcoded) ── */
const S = {
  sidebar: {
    width: 192, flexShrink: 0,
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 4,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const,
    color: 'var(--text-muted)', padding: '8px 12px 4px',
  },
  divider: { height: 1, background: 'var(--border)', margin: '4px 0' },
  modalOverlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
  },
  modal: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 20, width: '100%', maxWidth: 500,
    boxShadow: 'var(--shadow-card)',
  },
  modalHeader: {
    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalBody: { padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 14 },
  modalFooter: {
    padding: '14px 24px', borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 14,
    background: 'var(--bg-base)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none',
  },
  select: {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 14,
    background: 'var(--bg-base)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none',
  },
  error: {
    padding: '8px 12px', borderRadius: 8, fontSize: 12,
    background: 'var(--danger-bg)', border: '1px solid var(--danger)',
    color: 'var(--danger)',
  },
}

export default function AdminPage() {
  const supabase = createClient()
  const { user, loading: profileLoading } = useProfile()
  const [section, setSection] = useState<Section>('overview')

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s') as Section | null
    if (s) setSection(s)
  }, [])
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    if (user?.profile?.role !== 'super_admin') return
    supabase.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => setPendingRequests(count ?? 0))
    const ch = supabase.channel('access-requests-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, () => {
        supabase.from('access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
          .then(({ count }) => setPendingRequests(count ?? 0))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.profile?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  if (profileLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
  if (user?.profile?.role !== 'super_admin') return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Acceso denegado.</div>

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>
      {/* Sidebar temático */}
      <aside style={S.sidebar}>
        <span style={S.sectionLabel}>General</span>
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
        {/* Solicitudes con badge de pendientes */}
        <button onClick={() => setSection('solicitudes')} className={clsx('sidebar-item', section === 'solicitudes' && 'sidebar-item-active')} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Inbox size={14} />Solicitudes</span>
          {pendingRequests > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 6px', lineHeight: '16px' }}>
              {pendingRequests}
            </span>
          )}
        </button>
        <div style={S.divider} />
        <span style={S.sectionLabel}>Catálogo</span>
        <button onClick={() => setSection('productos')} className={clsx('sidebar-item', section === 'productos' && 'sidebar-item-active')}>
          <Package size={14} />Productos
        </button>
        <button onClick={() => setSection('chats')} className={clsx('sidebar-item', section === 'chats' && 'sidebar-item-active')}>
          <MessageSquare size={14} />Chats
        </button>
      </aside>

      <div style={{ flex: 1, padding: 24, overflowX: 'hidden' }}>
        {section === 'overview'     && <OverviewSection onNavigate={setSection} />}
        {section === 'empresas'     && <EmpresasSection />}
        {section === 'usuarios'     && <UsuariosSection />}
        {section === 'invitaciones' && <InvitacionesSection />}
        {section === 'solicitudes'  && <SolicitudesSection />}
        {section === 'productos'    && <ProductosSection />}
        {section === 'chats'        && <ChatsSection />}
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const max = orgStats[0]?.count || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Resumen</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Estado actual de Declavo</p>
        </div>
        <button onClick={() => onNavigate('invitaciones')} className="btn btn-primary"><Plus size={13} />Nueva invitación</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Empresas activas',     value: stats.orgs },
          { label: 'Productos publicados', value: stats.products },
          { label: 'Usuarios registrados', value: stats.users },
          { label: 'Invitaciones pendientes', value: stats.invites },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Productos por empresa</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orgStats.map(o => (
            <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
              <div style={{ flex: 1, height: 20, background: 'var(--bg-base)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent-glow)', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, width: `${Math.round(o.count / max * 100)}%`, minWidth: 32, border: '1px solid var(--border-accent)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{o.count}</span>
                </div>
              </div>
            </div>
          ))}
          {orgStats.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin datos aún.</p>}
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
  const [showModal, setShowModal] = useState(false)
  const [editOrg, setEditOrg]   = useState<Organization | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ name: '', legal_names: '', contact_email: '' })
  const [error, setError]       = useState('')

  const load = useCallback(() => {
    setLoading(true)
    supabase.from('organizations').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setOrgs((data as Organization[]) ?? []); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditOrg(null)
    setForm({ name: '', legal_names: '', contact_email: '', contact_whatsapp: '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(o: Organization) {
    setEditOrg(o)
    setForm({
      name: o.name,
      legal_names: (o.legal_names ?? []).join('\n'),
      contact_email: o.contact_email ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.name || !form.contact_email) { setError('Nombre y email son obligatorios.'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      legal_names: form.legal_names.split('\n').map(s => s.trim()).filter(Boolean),
      contact_email: form.contact_email.trim(),
    }
    if (editOrg) {
      const { error: e } = await supabase.from('organizations').update(payload).eq('id', editOrg.id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('organizations').insert({ ...payload, is_active: true })
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleToggle(org: Organization) {
    await supabase.from('organizations').update({ is_active: !org.is_active }).eq('id', org.id)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Empresas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Grupos y razones sociales</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={13} />Nueva empresa</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)', margin: 'auto' }} /></div> : (
          <table style={{ width: '100%', tableLayout: 'fixed' as const }}>
            <thead><tr>
              <th className="table-th">Empresa</th>
              <th className="table-th" style={{ width: 180 }}>Razones sociales</th>
              <th className="table-th" style={{ width: 90 }}>Estado</th>
              <th className="table-th" style={{ width: 90, textAlign: 'right' }}>Acciones</th>
            </tr></thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id} className="table-tr">
                  <td className="table-td">
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.contact_email}</div>
                  </td>
                  <td className="table-td" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.legal_names?.join(', ') || '—'}</td>
                  <td className="table-td">
                    <span className={clsx('badge', o.is_active ? 'badge-green' : 'badge-gray')}>{o.is_active ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="table-td"><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button onClick={() => openEdit(o)} className="icon-btn" title="Editar"><Pencil size={12} /></button>
                    <button onClick={() => handleToggle(o)} className="icon-btn" title={o.is_active ? 'Desactivar' : 'Activar'}>
                      {o.is_active ? <X size={12} /> : <Check size={12} />}
                    </button>
                  </div></td>
                </tr>
              ))}
              {orgs.length === 0 && <tr><td colSpan={4} className="table-td" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Sin empresas aún.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={S.modalOverlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editOrg ? 'Editar empresa' : 'Nueva empresa'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={S.modalBody}>
              <div>
                <label style={S.label}>Nombre del grupo *</label>
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="TechDistribuidora" />
              </div>
              <div>
                <label style={S.label}>Razones sociales (una por línea)</label>
                <textarea style={{ ...S.input, height: 72, resize: 'vertical' }} value={form.legal_names} onChange={e => setForm(f => ({ ...f, legal_names: e.target.value }))} placeholder={'TechDistrib. SRL\nTechImport SA'} />
              </div>
              <div>
                <label style={S.label}>Email de contacto *</label>
                <input type="email" style={S.input} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="admin@empresa.com" />
              </div>
              {error && <div style={S.error}>{error}</div>}
            </div>
            <div style={S.modalFooter}>
              <button onClick={() => setShowModal(false)} className="btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {editOrg ? 'Guardar cambios' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* USUARIOS                                                   */
/* ────────────────────────────────────────────────────────── */
function UsuariosSection() {
  const supabase = createClient()
  const [users, setUsers]   = useState<(Profile & { org_name?: string; email?: string })[]>([])
  const [orgs, setOrgs]     = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser]   = useState<(Profile & { org_name?: string; email?: string }) | null>(null)
  const [form, setForm]     = useState({ full_name: '', role: 'member' as 'super_admin' | 'org_admin' | 'member', organization_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUsers((data ?? []).map((u: any) => ({ ...u, org_name: u.organizations?.name ?? '—' })))
    const { data: orgData } = await supabase.from('organizations').select('id,name').eq('is_active', true)
    setOrgs((orgData ?? []) as Organization[])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function openEdit(u: Profile & { org_name?: string }) {
    setEditUser(u)
    setForm({
      full_name: u.full_name ?? '',
      role: u.role as 'super_admin' | 'org_admin' | 'member',
      organization_id: u.organization_id ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)
    const { error: e } = await supabase.from('profiles').update({
      full_name: form.full_name,
      role: form.role,
      organization_id: form.organization_id || null,
    }).eq('id', editUser.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setShowModal(false)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Usuarios</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Todos los usuarios de la plataforma</p>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)', margin: 'auto' }} /></div> : (
          <table style={{ width: '100%', tableLayout: 'fixed' as const }}>
            <thead><tr>
              <th className="table-th">Usuario</th>
              <th className="table-th">Email de acceso</th>
              <th className="table-th">Empresa</th>
              <th className="table-th" style={{ width: 110 }}>Rol</th>
              <th className="table-th" style={{ width: 60, textAlign: 'right' }}>Editar</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="table-tr">
                  <td className="table-td">
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.full_name || 'Sin nombre'}</div>
                  </td>
                  <td className="table-td" style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{(u as { email?: string }).email ?? u.id.slice(0, 8) + '…'}</td>
                  <td className="table-td" style={{ color: 'var(--text-secondary)' }}>{u.org_name}</td>
                  <td className="table-td">
                    <span className={clsx('badge', u.role === 'super_admin' ? 'badge-red' : u.role === 'org_admin' ? 'badge-purple' : 'badge-gray')}>
                      {u.role}
                    </span>
                  </td>
                  <td className="table-td"><div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(u)} className="icon-btn" title="Editar usuario"><Pencil size={12} /></button>
                  </div></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="table-td" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Sin usuarios aún.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showModal && editUser && (
        <div style={S.modalOverlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Editar usuario</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{editUser.id}</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={S.modalBody}>
              <div>
                <label style={S.label}>Nombre completo</label>
                <input style={S.input} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan García" />
              </div>
              <div>
                <label style={S.label}>Empresa</label>
                <select style={S.select} value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                  <option value="">— Sin empresa —</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Rol</label>
                <select style={S.select} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'super_admin' | 'org_admin' | 'member' }))}>
                  <option value="member">Miembro (solo lectura)</option>
                  <option value="org_admin">Administrador de empresa</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {error && <div style={S.error}>{error}</div>}
            </div>
            <div style={S.modalFooter}>
              <button onClick={() => setShowModal(false)} className="btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
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

  const now      = new Date()
  const pending  = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) > now)
  const accepted = invitations.filter(i => i.accepted_at)
  const expired  = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) <= now)
  const shown    = tab === 'pending' ? pending : tab === 'accepted' ? accepted : expired

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Invitaciones</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Sistema de acceso cerrado</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary"><Plus size={13} />Nueva invitación</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Nueva invitación</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>Email *</label>
                <input type="email" style={S.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com" />
              </div>
              <div>
                <label style={S.label}>Expira en</label>
                <select style={S.select} value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}>
                  {[['3','3 días'],['7','7 días'],['14','14 días'],['30','30 días']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={S.label}>Empresa *</label>
              <select style={S.select} value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Rol</label>
              <select style={S.select} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'org_admin' | 'member' }))}>
                <option value="member">Miembro (lectura)</option>
                <option value="org_admin">Administrador de empresa</option>
              </select>
            </div>
            {error && <div style={S.error}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button onClick={() => setShowForm(false)} className="btn">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}Generar link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([['pending', `Pendientes (${pending.length})`], ['accepted', `Aceptadas (${accepted.length})`], ['expired', `Expiradas (${expired.length})`]] as const).map(([id, label]) => (
          <button
            key={id} onClick={() => setTab(id)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: tab === id ? 'var(--bg-card)' : 'transparent',
              color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === id ? 'var(--shadow-card)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)', margin: 'auto' }} /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {shown.map(inv => (
            <div key={inv.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{inv.org_name} · <span className="badge badge-gray">{inv.role}</span></p>
                </div>
                <span className={clsx('badge', tab === 'accepted' ? 'badge-green' : tab === 'expired' ? 'badge-gray' : 'badge-amber')} style={{ flexShrink: 0 }}>
                  {tab === 'accepted' ? 'Aceptada' : tab === 'expired' ? 'Expirada' : 'Pendiente'}
                </span>
              </div>
              {tab === 'pending' && (
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{inv.token.slice(0, 20)}…</span>
                  <button onClick={() => handleCopy(inv.token)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexShrink: 0 }}>
                    {copied === inv.token ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                    {copied === inv.token ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              )}
              {tab === 'accepted' && inv.accepted_at && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Aceptada el {new Date(inv.accepted_at).toLocaleDateString('es-AR')}</p>
              )}
              {tab === 'pending' && (
                <button onClick={() => handleRevoke(inv.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  Revocar invitación
                </button>
              )}
            </div>
          ))}
          {shown.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', gridColumn: '1/-1' }}>
              {tab === 'pending' ? 'Sin invitaciones pendientes.' : tab === 'accepted' ? 'Sin invitaciones aceptadas.' : 'Sin invitaciones expiradas.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* SOLICITUDES DE ACCESO                                      */
/* ────────────────────────────────────────────────────────── */
function SolicitudesSection() {
  const supabase = createClient()
  const { user } = useProfile()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [orgs, setOrgs]         = useState<Organization[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  const [approveModal, setApproveModal] = useState<AccessRequest | null>(null)
  const [invForm, setInvForm]     = useState({ org_id: '', role: 'member' as 'member' | 'org_admin' })
  const [invSaving, setInvSaving] = useState(false)
  const [invError, setInvError]   = useState('')
  const [approveSuccess, setApproveSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false })
    setRequests((data ?? []) as AccessRequest[])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    supabase.from('organizations').select('id,name').eq('is_active', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setOrgs((data ?? []) as any))

    const ch = supabase.channel('solicitudes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_requests' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function handleReject(req: AccessRequest) {
    if (!confirm(`¿Rechazar la solicitud de ${req.name}?`)) return
    setProcessing(req.id)
    await supabase.from('access_requests').update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: user?.id ?? null,
    }).eq('id', req.id)
    setProcessing(null)
    load()
  }

  function openApprove(req: AccessRequest) {
    setApproveModal(req)
    setInvForm({ org_id: '', role: 'member' })
    setInvError('')
    setApproveSuccess(false)
  }

  async function handleApprove() {
    if (!approveModal) return
    if (!invForm.org_id) { setInvError('Seleccioná una empresa.'); return }
    setInvSaving(true)
    setInvError('')

    const res = await fetch('/api/approve-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: approveModal.id,
        email:     approveModal.email,
        name:      approveModal.name,
        orgId:     invForm.org_id,
        role:      invForm.role,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setInvError((err as { error?: string }).error ?? 'Error al procesar la solicitud.')
      setInvSaving(false)
      return
    }

    setInvSaving(false)
    setApproveSuccess(true)
    load()
  }

  function fmt(iso: string) {
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const pending  = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const rejected = requests.filter(r => r.status === 'rejected')
  const shown    = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Solicitudes de acceso</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Usuarios que pidieron acceso a la plataforma</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          ['pending',  `Pendientes (${pending.length})`],
          ['approved', `Aprobadas (${approved.length})`],
          ['rejected', `Rechazadas (${rejected.length})`],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: tab === id ? 'var(--bg-card)' : 'transparent',
            color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === id ? 'var(--shadow-card)' : 'none',
          }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)', margin: 'auto' }} /></div>
      ) : shown.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Inbox size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            {tab === 'pending' ? 'Sin solicitudes pendientes.' : tab === 'approved' ? 'Sin solicitudes aprobadas.' : 'Sin solicitudes rechazadas.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(req => (
            <div key={req.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Avatar */}
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                {req.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{req.name}</span>
                  {req.company && <span className="badge badge-gray">{req.company}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(req.created_at)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--accent)' }}>{req.email}</p>
                {req.message && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{req.message}</p>
                )}
              </div>

              {/* Acciones */}
              {tab === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={processing === req.id}
                    className="btn"
                    style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    <X size={12} /> Rechazar
                  </button>
                  <button
                    onClick={() => openApprove(req)}
                    disabled={processing === req.id}
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                  >
                    <Check size={12} /> Aprobar
                  </button>
                </div>
              )}
              {tab === 'approved' && (
                <span className="badge badge-green" style={{ flexShrink: 0 }}>Aprobada</span>
              )}
              {tab === 'rejected' && (
                <span className="badge badge-gray" style={{ flexShrink: 0 }}>Rechazada</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de aprobación */}
      {approveModal && (
        <div style={S.modalOverlay} onClick={e => e.target === e.currentTarget && !approveSuccess && setApproveModal(null)}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Aprobar solicitud</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{approveModal.name} · {approveModal.email}</p>
              </div>
              {!approveSuccess && <button onClick={() => setApproveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>}
            </div>

            {approveSuccess ? (
              <div style={{ ...S.modalBody, alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', margin: '0 auto' }}>
                  <Check size={22} />
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>¡Acceso otorgado!</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  Se envió un email de activación a <strong style={{ color: 'var(--text-primary)' }}>{approveModal.email}</strong>.<br />
                  Cuando lo reciba podrá completar el registro.
                </p>
              </div>
            ) : (
              <div style={S.modalBody}>
                <div>
                  <label style={S.label}>Empresa *</label>
                  <select style={S.select} value={invForm.org_id} onChange={e => setInvForm(f => ({ ...f, org_id: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Rol</label>
                  <select style={S.select} value={invForm.role} onChange={e => setInvForm(f => ({ ...f, role: e.target.value as 'member' | 'org_admin' }))}>
                    <option value="member">Miembro (lectura)</option>
                    <option value="org_admin">Administrador de empresa</option>
                  </select>
                </div>
                {invError && <div style={S.error}>{invError}</div>}
              </div>
            )}

            <div style={S.modalFooter}>
              {approveSuccess ? (
                <button onClick={() => setApproveModal(null)} className="btn btn-primary">Listo</button>
              ) : (
                <>
                  <button onClick={() => setApproveModal(null)} className="btn">Cancelar</button>
                  <button onClick={handleApprove} disabled={invSaving} className="btn btn-primary">
                    {invSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Otorgar acceso
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* PRODUCTOS (solo lectura desde admin)                       */
/* ────────────────────────────────────────────────────────── */
function ProductosSection() {
  const supabase = createClient()
  const [products, setProducts] = useState<{ id: string; sku: string; description: string; brand: string; stock_quantity: number; status: string; org_name?: string }[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.from('catalog_view').select('*').order('created_at', { ascending: false }).limit(200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => { setProducts((data ?? []) as any); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Productos</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Vista global del catálogo (los últimos 200)</p>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)', margin: 'auto' }} /></div> : (
          <table style={{ width: '100%', tableLayout: 'fixed' as const }}>
            <thead><tr>
              <th className="table-th" style={{ width: 110 }}>SKU</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" style={{ width: 100 }}>Marca</th>
              <th className="table-th" style={{ width: 80 }}>Stock</th>
              <th className="table-th" style={{ width: 90 }}>Estado</th>
              <th className="table-th" style={{ width: 150 }}>Empresa</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td" style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.sku}</td>
                  <td className="table-td" style={{ color: 'var(--text-primary)', fontWeight: 500 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</span></td>
                  <td className="table-td"><span className="badge-accent">{p.brand}</span></td>
                  <td className="table-td">{p.stock_quantity}</td>
                  <td className="table-td"><span className={clsx('badge', p.status === 'active' ? 'badge-green' : 'badge-gray')}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span></td>
                  <td className="table-td" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.org_name ?? '—'}</td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} className="table-td" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Sin productos.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/* CHATS — visibilidad total para el admin                    */
/* ────────────────────────────────────────────────────────── */
function ChatsSection() {
  const supabase = createClient()

  interface AdminThread {
    product_id: string
    sku: string
    product_description: string
    product_org: string
    last_body: string
    last_at: string
    msg_count: number
  }
  interface AdminMessage {
    id: string
    body: string
    created_at: string
    sender_org_name: string | null
    sender_name: string
    sender_id: string
  }

  const [threads, setThreads]           = useState<AdminThread[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeThread, setActiveThread] = useState<AdminThread | null>(null)
  const [messages, setMessages]         = useState<AdminMessage[]>([])
  const [msgLoading, setMsgLoading]     = useState(false)
  const bottomRef                       = useRef<HTMLDivElement>(null)

  const fetchThreads = useCallback(async () => {
    setLoading(true)

    // Todos los productos con mensajes
    const { data: msgs } = await supabase
      .from('product_messages')
      .select('product_id, body, created_at')
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) { setLoading(false); return }

    const productIds = [...new Set((msgs as { product_id: string }[]).map(m => m.product_id))]

    const { data: products } = await supabase
      .from('products')
      .select('id, sku, description, organization_id, organizations(name)')
      .in('id', productIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prodMap: Record<string, { sku: string; description: string; org: string }> = {}
    ;(products ?? []).forEach((p: { id: string; sku: string; description: string; organizations: { name: string } | null }) => {
      prodMap[p.id] = {
        sku: p.sku,
        description: p.description,
        org: p.organizations?.name ?? '—',
      }
    })

    const threadMap: Record<string, AdminThread> = {}
    ;(msgs as { product_id: string; body: string; created_at: string }[]).forEach(m => {
      const prod = prodMap[m.product_id]
      if (!prod) return
      if (!threadMap[m.product_id]) {
        threadMap[m.product_id] = {
          product_id:          m.product_id,
          sku:                 prod.sku,
          product_description: prod.description,
          product_org:         prod.org,
          last_body:           m.body,
          last_at:             m.created_at,
          msg_count:           0,
        }
      }
      threadMap[m.product_id].msg_count++
    })

    setThreads(Object.values(threadMap).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()))
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchThreads()
    const ch = supabase.channel('admin-chats-threads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_messages' }, () => fetchThreads())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchThreads])

  const fetchMessages = useCallback(async (productId: string) => {
    setMsgLoading(true)
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, sender_id, sender_org_id, body, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: true })

    if (!rawMsgs || rawMsgs.length === 0) { setMessages([]); setMsgLoading(false); return }

    const senderIds = [...new Set((rawMsgs as { sender_id: string }[]).map(m => m.sender_id))]
    const orgIds    = [...new Set((rawMsgs as { sender_org_id: string | null }[]).map(m => m.sender_org_id).filter(Boolean))] as string[]

    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', senderIds),
      orgIds.length > 0 ? supabase.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
    ])

    const profileMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => { profileMap[p.id] = p.full_name ?? 'Usuario' })
    const orgMap: Record<string, string> = {}
    ;(orgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setMessages((rawMsgs as { id: string; sender_id: string; sender_org_id: string | null; body: string; created_at: string }[]).map(m => ({
      id:              m.id,
      body:            m.body,
      created_at:      m.created_at,
      sender_id:       m.sender_id,
      sender_name:     profileMap[m.sender_id] ?? 'Usuario',
      sender_org_name: m.sender_org_id ? (orgMap[m.sender_org_id] ?? null) : null,
    })))
    setMsgLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeThread) return
    fetchMessages(activeThread.product_id)
    const ch = supabase.channel(`admin-chat-${activeThread.product_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'product_messages',
        filter: `product_id=eq.${activeThread.product_id}`,
      }, () => fetchMessages(activeThread.product_id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeThread, fetchMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fmtRel  = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1)    return 'ahora'
    if (diff < 60)   return `${diff} min`
    if (diff < 1440) return `${Math.floor(diff / 60)} h`
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px - 48px)', overflow: 'hidden', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>

      {/* Lista de hilos */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-surface)' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>Todos los chats</h1>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Visibilidad en tiempo real</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 12, margin: 0 }}>Sin conversaciones aún</p>
          </div>
        ) : (
          threads.map(t => (
            <button
              key={t.product_id}
              onClick={() => setActiveThread(t)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                padding: '12px 16px', textAlign: 'left', cursor: 'pointer', border: 'none',
                borderBottom: '1px solid var(--border)', transition: 'all 0.15s', width: '100%',
                background: activeThread?.product_id === t.product_id ? 'var(--accent-glow)' : 'transparent',
                borderLeft: activeThread?.product_id === t.product_id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{t.sku}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtRel(t.last_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t.product_description}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t.last_body}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {t.product_org}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.msg_count} msg</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Conversación */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        {!activeThread ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--text-secondary)' }}>Seleccioná una conversación</p>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.3px' }}>{activeThread.sku}</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{activeThread.product_description}</p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{activeThread.product_org}</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msgLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>
                      {m.sender_org_name ?? m.sender_name}
                    </span>
                    <div style={{
                      maxWidth: '75%', padding: '10px 14px',
                      borderRadius: '14px 14px 14px 4px',
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                    }}>
                      {m.body}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{fmtTime(m.created_at)}</span>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
