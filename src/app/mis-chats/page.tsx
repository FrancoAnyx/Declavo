'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'
import type { ChatSessionStatus } from '@/types/database'

/* ── Icons ── */
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

/* ── Predefined seller responses ── */
const SELLER_MESSAGES = [
  'Sí, tenemos stock disponible',
  'No tenemos stock en este momento',
  'El precio es a convenir — contactanos para coordinar',
  'Podemos negociar condiciones de pago',
  'Te enviamos cotización formal a la brevedad',
  'Gracias por tu consulta, te respondemos pronto',
]

/* ── Types ── */
interface SessionRow {
  id: string
  status: ChatSessionStatus
  sale_price: number | null
  last_message_at: string
  last_message_from: string | null
  buyer_org_id: string
  product_id: string
  buyer_org_name: string
  product_sku: string
  product_description: string
}

interface RawMessage {
  id: string
  product_id: string
  session_id: string | null
  sender_id: string
  sender_org_id: string | null
  body: string
  created_at: string
}
interface DisplayMessage extends RawMessage {
  sender_org_name: string | null
  is_mine: boolean
}

/* ── Page ── */
export default function MisChatsPage() {
  const supabase = createClient()
  const { user, loading: profileLoading } = useProfile()
  const myOrgId = user?.organization?.id ?? null

  const [sessions, setSessions]        = useState<SessionRow[]>([])
  const [loadingSessions, setLoadingS] = useState(true)
  const [selectedId, setSelectedId]    = useState<string | null>(null)
  const [messages, setMessages]        = useState<DisplayMessage[]>([])
  const [loadingMsgs, setLoadingMsgs]  = useState(false)
  const [sending, setSending]          = useState(false)

  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReason, setCloseReason]       = useState<'no_deal' | 'agreed' | null>(null)
  const [salePrice, setSalePrice]           = useState('')
  const [closing, setClosing]               = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── Load seller sessions ── */
  const loadSessions = useCallback(async () => {
    if (!myOrgId) { setLoadingS(false); return }

    const { data: myProducts } = await supabase
      .from('products')
      .select('id, sku, description')
      .eq('organization_id', myOrgId)

    if (!myProducts?.length) { setSessions([]); setLoadingS(false); return }

    const productIds = myProducts.map((p: { id: string }) => p.id)
    const productMap: Record<string, { sku: string; description: string }> = {}
    ;(myProducts as { id: string; sku: string; description: string }[]).forEach(p => {
      productMap[p.id] = { sku: p.sku, description: p.description }
    })

    const { data: chatSessions } = await supabase
      .from('chat_sessions')
      .select('id, status, sale_price, last_message_at, last_message_from, buyer_org_id, product_id')
      .in('product_id', productIds)
      .order('last_message_at', { ascending: false })

    if (!chatSessions?.length) { setSessions([]); setLoadingS(false); return }

    const buyerOrgIds = [...new Set((chatSessions as { buyer_org_id: string }[]).map(s => s.buyer_org_id))]
    const { data: buyerOrgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', buyerOrgIds)

    const orgMap: Record<string, string> = {}
    ;(buyerOrgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setSessions((chatSessions as {
      id: string; status: string; sale_price: number | null; last_message_at: string;
      last_message_from: string | null; buyer_org_id: string; product_id: string;
    }[]).map(s => ({
      ...s,
      status: s.status as ChatSessionStatus,
      buyer_org_name: orgMap[s.buyer_org_id] ?? 'Empresa',
      product_sku: productMap[s.product_id]?.sku ?? '',
      product_description: productMap[s.product_id]?.description ?? '',
    })))
    setLoadingS(false)
  }, [myOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (myOrgId) loadSessions() }, [loadSessions, myOrgId])

  /* ── Load messages for selected session ── */
  const loadMessages = useCallback(async (sid: string) => {
    setLoadingMsgs(true)
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, product_id, session_id, sender_id, sender_org_id, body, created_at')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })

    if (!rawMsgs?.length) { setMessages([]); setLoadingMsgs(false); return }

    const orgIds = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_org_id).filter(Boolean))] as string[]
    const { data: orgs } = orgIds.length
      ? await supabase.from('organizations').select('id, name').in('id', orgIds)
      : { data: [] }

    const orgMap: Record<string, string> = {}
    ;(orgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setMessages((rawMsgs as RawMessage[]).map(m => ({
      ...m,
      sender_org_name: m.sender_org_id ? (orgMap[m.sender_org_id] ?? null) : null,
      is_mine: m.sender_org_id === myOrgId,
    })))
    setLoadingMsgs(false)
  }, [myOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectSession(id: string) {
    setSelectedId(id)
    loadMessages(id)
    setShowCloseModal(false)
    setCloseReason(null)
    setSalePrice('')
  }

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!selectedId) return
    const ch = supabase
      .channel(`seller-chat-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'product_messages',
        filter: `session_id=eq.${selectedId}`,
      }, () => { loadMessages(selectedId); loadSessions() })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'chat_sessions',
        filter: `id=eq.${selectedId}`,
      }, () => loadSessions())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Send seller message ── */
  async function sendMessage(text: string) {
    if (!selectedId || !user || sending) return
    const currentSession = sessions.find(s => s.id === selectedId)
    if (!currentSession || currentSession.status !== 'open') return

    setSending(true)
    await supabase.from('product_messages').insert({
      product_id:    currentSession.product_id,
      session_id:    selectedId,
      sender_id:     user.id,
      sender_org_id: myOrgId,
      body:          text,
    })
    fetch('/api/chat/notify-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: selectedId, messageBody: text, senderRole: 'seller' }),
    }).catch(() => {})
    setSending(false)
    await loadMessages(selectedId)
    loadSessions()
  }

  /* ── Close session ── */
  async function handleClose() {
    if (!selectedId || !closeReason) return
    if (closeReason === 'agreed' && !salePrice.trim()) return
    setClosing(true)
    await fetch('/api/chat/close-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: selectedId,
        reason: closeReason,
        ...(closeReason === 'agreed' ? { salePrice: parseFloat(salePrice) } : {}),
      }),
    })
    setClosing(false)
    setShowCloseModal(false)
    setCloseReason(null)
    setSalePrice('')
    await loadSessions()
  }

  /* ── Helpers ── */
  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toDateString() === new Date().toDateString()
      ? 'Hoy'
      : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  type Group = { date: string; msgs: DisplayMessage[] }
  const grouped: Group[] = []
  messages.forEach(m => {
    const d = new Date(m.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== d) grouped.push({ date: d, msgs: [m] })
    else last.msgs.push(m)
  })

  const currentSession = sessions.find(s => s.id === selectedId) ?? null
  const isOpen = currentSession?.status === 'open'

  if (!profileLoading && !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Iniciá sesión</a> para ver tus chats.
        </p>
      </div>
    )
  }

  if (!profileLoading && !myOrgId) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Tu usuario no tiene empresa asignada.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: 'var(--bg-base)' }}>

      {/* ── Lista de sesiones ── */}
      <div style={{
        width: 300, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
            Mis Chats
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {sessions.filter(s => s.status === 'open').length} consultas activas
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingSessions ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Cargando…
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Sin consultas aún</p>
            </div>
          ) : (
            sessions.map(s => {
              const needsReply = s.status === 'open' && s.last_message_from === 'buyer'
              const isSelected = s.id === selectedId
              return (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'var(--accent-glow)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    cursor: 'pointer', transition: 'all 0.12s', border: 'none',
                    borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--border)',
                    borderLeftWidth: isSelected ? 3 : 3, borderLeftStyle: 'solid',
                    borderLeftColor: isSelected ? 'var(--accent)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {s.buyer_org_name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {fmtTime(s.last_message_at)}
                    </span>
                  </div>
                  <p style={{
                    margin: '0 0 5px', fontSize: 11, color: 'var(--accent)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.product_sku}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {s.status !== 'open' ? (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: 'var(--text-muted)',
                        background: 'var(--bg-base)', borderRadius: 5, padding: '2px 6px',
                        border: '1px solid var(--border)',
                      }}>
                        <LockIcon />
                        {s.status === 'closed_agreed'
                          ? `Acordado${s.sale_price ? ` $${s.sale_price.toLocaleString('es-AR')}` : ''}`
                          : 'Sin acuerdo'}
                      </span>
                    ) : needsReply ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                        <ClockIcon /> Responder
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        <CheckIcon /> Respondido
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Panel de mensajes ── */}
      {!selectedId ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 44 }}>💬</div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Seleccioná una consulta
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Elegí una conversación de la lista para responder
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {currentSession?.buyer_org_name}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--accent)' }}>
                {currentSession?.product_sku} — {currentSession?.product_description}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {currentSession?.status !== 'open' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 7,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text-muted)',
                }}>
                  <LockIcon />
                  {currentSession?.status === 'closed_agreed'
                    ? `Acordado${currentSession?.sale_price ? ` — $${currentSession.sale_price.toLocaleString('es-AR')}` : ''}`
                    : 'Sin acuerdo'}
                </span>
              )}
              {isOpen && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)',
                    color: '#dc3545', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <LockIcon /> Finalizar consulta
                </button>
              )}
            </div>
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {loadingMsgs ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 32 }}>
                Cargando mensajes…
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <p style={{ margin: 0 }}>Sin mensajes en esta sesión</p>
              </div>
            ) : (
              grouped.map(group => (
                <div key={group.date}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', padding: '0 6px' }}>
                      {fmtDate(group.msgs[0].created_at)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {group.msgs.map(m => {
                    const label = m.is_mine ? 'Vos' : (m.sender_org_name ?? 'Comprador')
                    return (
                      <div key={m.id} style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: m.is_mine ? 'flex-end' : 'flex-start',
                        marginBottom: 12,
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                          marginBottom: 4,
                          padding: m.is_mine ? '0 4px 0 0' : '0 0 0 4px',
                        }}>
                          {label}
                        </span>
                        <div style={{
                          maxWidth: '78%', padding: '10px 14px',
                          borderRadius: m.is_mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: m.is_mine ? 'var(--accent)' : 'var(--bg-base)',
                          border: m.is_mine ? 'none' : '1px solid var(--border)',
                          color: m.is_mine ? '#fff' : 'var(--text-primary)',
                          fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                        }}>
                          {m.body}
                        </div>
                        <span style={{
                          fontSize: 10, color: 'var(--text-muted)', marginTop: 3,
                          padding: m.is_mine ? '0 4px 0 0' : '0 0 0 4px',
                        }}>
                          {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Botones de respuesta predefinidos */}
          {isOpen && (
            <div style={{
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              padding: '14px 18px',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Responder
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {SELLER_MESSAGES.map(msg => (
                  <button
                    key={msg}
                    onClick={() => sendMessage(msg)}
                    disabled={sending}
                    style={{
                      padding: '9px 12px', borderRadius: 9,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.35,
                      transition: 'all 0.15s', opacity: sending ? 0.5 : 1,
                    }}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de cierre ── */}
      {showCloseModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowCloseModal(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '28px 24px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Finalizar consulta
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
              {currentSession?.buyer_org_name} — {currentSession?.product_sku}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(['no_deal', 'agreed'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => { setCloseReason(opt); setSalePrice('') }}
                  style={{
                    padding: '12px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    background: closeReason === opt ? 'var(--accent-glow)' : 'var(--bg-base)',
                    border: `1px solid ${closeReason === opt ? 'var(--border-accent)' : 'var(--border)'}`,
                    color: closeReason === opt ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: closeReason === opt ? 700 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt === 'no_deal' ? '❌ No llegamos a un acuerdo' : '✅ Llegamos a un acuerdo'}
                </button>
              ))}
            </div>

            {closeReason === 'agreed' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Precio de venta acordado (para registro de comisión)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 9,
                    border: '1px solid var(--border-accent)',
                    background: 'var(--bg-base)', color: 'var(--text-primary)',
                    fontSize: 15, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCloseModal(false); setCloseReason(null); setSalePrice('') }}
                style={{
                  padding: '9px 18px', borderRadius: 9,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={!closeReason || (closeReason === 'agreed' && !salePrice.trim()) || closing}
                style={{
                  padding: '9px 20px', borderRadius: 9,
                  background: closeReason ? 'var(--accent)' : 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: closeReason ? '#fff' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600,
                  cursor: (closeReason && !(closeReason === 'agreed' && !salePrice.trim())) ? 'pointer' : 'not-allowed',
                  opacity: closing ? 0.6 : 1,
                }}
              >
                {closing ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
