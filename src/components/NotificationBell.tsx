'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'

function BellIcon({ hasNew }: { hasNew: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={hasNew ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

interface NotifMessage {
  id: string
  product_id: string
  product_description: string
  sku: string
  sender_org_name: string | null
  sender_name: string | null
  body: string
  created_at: string
  is_mine: boolean
}

interface AccessReqNotif {
  id: string
  name: string
  email: string
  company: string | null
  created_at: string
}

// Toast flotante
function Toast({ msg, onClose }: { msg: NotifMessage; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: 24, zIndex: 400,
      background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
      borderRadius: 14, padding: '12px 16px', width: 320,
      boxShadow: 'var(--shadow-card), 0 0 30px rgba(99,102,241,0.15)',
      animation: 'toastIn 0.28s ease both',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <ChatIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {msg.sender_org_name ?? msg.sender_name ?? 'Alguien'} preguntó
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {msg.sku}: {msg.body}
        </p>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}><XIcon /></button>
    </div>
  )
}

export default function NotificationBell() {
  const supabase = createClient()
  const router   = useRouter()
  const { user } = useProfile()
  const orgId    = user?.profile?.organization_id
  const isSuperAdmin = user?.profile?.role === 'super_admin'

  const [unread, setUnread]               = useState<NotifMessage[]>([])
  const [accessReqs, setAccessReqs]       = useState<AccessReqNotif[]>([])
  const [open, setOpen]                   = useState(false)
  const [toast, setToast]                 = useState<NotifMessage | null>(null)
  const [accessToast, setAccessToast]     = useState<AccessReqNotif | null>(null)
  const [readIds, setReadIds]             = useState<Set<string>>(new Set())
  const [readReqIds, setReadReqIds]       = useState<Set<string>>(new Set())
  const panelRef                          = useRef<HTMLDivElement>(null)
  const knownIds                          = useRef<Set<string>>(new Set())
  const knownReqIds                       = useRef<Set<string>>(new Set())
  const initialized                       = useRef(false)
  const initializedReqs                   = useRef(false)

  const fetchUnread = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('chat_summary')
      .select('id, product_id, product_description, sku, sender_org_name, sender_name, body, created_at, sender_org_id, product_org_id')
      .eq('product_org_id', orgId)
      .neq('sender_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (!data) return
    const msgs: NotifMessage[] = (data as {
      id: string; product_id: string; product_description: string; sku: string;
      sender_org_name: string | null; sender_name: string | null; body: string;
      created_at: string; sender_org_id: string | null; product_org_id: string;
    }[]).map(m => ({
      id: m.id, product_id: m.product_id, product_description: m.product_description,
      sku: m.sku, sender_org_name: m.sender_org_name, sender_name: m.sender_name,
      body: m.body, created_at: m.created_at, is_mine: false,
    })).filter(m => !readIds.has(m.id))
    if (!initialized.current) {
      msgs.forEach(m => knownIds.current.add(m.id))
      initialized.current = true
      setUnread(msgs)
      return
    }
    const newMsgs = msgs.filter(m => !knownIds.current.has(m.id))
    newMsgs.forEach(m => knownIds.current.add(m.id))
    if (newMsgs.length > 0) setToast(newMsgs[0])
    setUnread(msgs)
  }, [orgId, readIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAccessReqs = useCallback(async () => {
    if (!isSuperAdmin) return
    const { data } = await supabase
      .from('access_requests')
      .select('id, name, email, company, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20)
    if (!data) return
    const reqs = (data as AccessReqNotif[]).filter(r => !readReqIds.has(r.id))
    if (!initializedReqs.current) {
      reqs.forEach(r => knownReqIds.current.add(r.id))
      initializedReqs.current = true
      setAccessReqs(reqs)
      return
    }
    const newReqs = reqs.filter(r => !knownReqIds.current.has(r.id))
    newReqs.forEach(r => knownReqIds.current.add(r.id))
    if (newReqs.length > 0) setAccessToast(newReqs[0])
    setAccessReqs(reqs)
  }, [isSuperAdmin, readReqIds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!orgId) return
    fetchUnread()
    const ch = supabase.channel('global-chat-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_messages' }, () => fetchUnread())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchUnread, orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchAccessReqs()
    const ch = supabase.channel('access-requests-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'access_requests' }, () => fetchAccessReqs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchAccessReqs, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function markRead(id: string) {
    setReadIds(prev => new Set([...prev, id]))
    setUnread(prev => prev.filter(m => m.id !== id))
  }
  function markReqRead(id: string) {
    setReadReqIds(prev => new Set([...prev, id]))
    setAccessReqs(prev => prev.filter(r => r.id !== id))
  }
  function markAllRead() {
    setReadIds(prev => new Set([...prev, ...unread.map(m => m.id)]))
    setReadReqIds(prev => new Set([...prev, ...accessReqs.map(r => r.id)]))
    setUnread([])
    setAccessReqs([])
    setOpen(false)
  }

  function fmt(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return 'ahora'
    if (diff < 3600) return `${Math.floor(diff/60)} min`
    if (diff < 86400) return `${Math.floor(diff/3600)} h`
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  if (!orgId && !isSuperAdmin) return null

  const count = unread.length + accessReqs.length

  return (
    <>
      {/* Campana */}
      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setOpen(v => !v)}
          title="Notificaciones"
          style={{
            width: 38, height: 38, borderRadius: 9, marginRight: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.18s',
            background: open ? 'var(--accent-glow)' : 'var(--bg-card)',
            border: `1px solid ${open ? 'var(--border-accent)' : 'var(--border)'}`,
            color: count > 0 ? 'var(--accent)' : 'var(--text-secondary)',
            position: 'relative',
          }}
        >
          <BellIcon hasNew={count > 0} />
          {count > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 0 2px var(--bg-surface)',
            }} />
          )}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 340, maxHeight: 420, overflowY: 'auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, boxShadow: 'var(--shadow-card)',
            animation: 'modalIn 0.18s ease both', zIndex: 200,
          }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                Notificaciones {count > 0 && <span style={{ color: 'var(--accent)' }}>({count})</span>}
              </p>
              {count > 0 && (
                <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* Solicitudes de acceso (solo super_admin) */}
            {accessReqs.length > 0 && (
              <>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Solicitudes de acceso
                </div>
                {accessReqs.map(r => (
                  <div key={r.id} style={{
                    padding: '10px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: 'rgba(99,102,241,0.06)',
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>
                      <InboxIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.company ? `${r.company} · ` : ''}{r.email}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(r.created_at)}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { markReqRead(r.id); router.push('/admin?s=solicitudes'); setOpen(false) }}
                          style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Ver
                        </button>
                        <button onClick={() => markReqRead(r.id)} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Consultas de chat */}
            {unread.length > 0 && (
              <>
                {accessReqs.length > 0 && (
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Consultas de productos
                  </div>
                )}
                {unread.map(m => (
                  <div key={m.id} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: 'var(--accent-glow)',
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {(m.sender_org_name ?? m.sender_name ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {m.sender_org_name ?? m.sender_name ?? 'Alguien'}
                      </p>
                      <p style={{ margin: '1px 0 3px', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{m.sku}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.body}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(m.created_at)}</span>
                      <button onClick={() => markRead(m.id)} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✓ Leído</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {count === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                <p style={{ margin: 0, fontSize: 13 }}>Sin notificaciones nuevas</p>
              </div>
            )}

            {orgId && (
              <div style={{ padding: '10px 16px', borderTop: count > 0 ? '1px solid var(--border)' : 'none' }}>
                <a href="/mis-chats" onClick={() => setOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                  fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none',
                  padding: '6px', borderRadius: 8, transition: 'background 0.15s',
                }}>
                  <ChatIcon /> Ver todos los chats de mi empresa
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Toast de nueva solicitud de acceso */}
      {accessToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 400,
          background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
          borderRadius: 14, padding: '12px 16px', width: 320,
          boxShadow: 'var(--shadow-card), 0 0 30px rgba(99,102,241,0.15)',
          animation: 'toastIn 0.28s ease both',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <InboxIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Nueva solicitud de acceso
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {accessToast.name}{accessToast.company ? ` · ${accessToast.company}` : ''}
            </p>
          </div>
          <button onClick={() => setAccessToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}><XIcon /></button>
        </div>
      )}
    </>
  )
}
