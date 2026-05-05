'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'

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
interface ProductThread {
  productId: string
  productSku: string
  productDescription: string
  lastMessageAt: string
  messageCount: number
  openSessionId: string | null
  openSessionStatus: string | null
  openSessionSalePrice: number | null
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

  const [threads, setThreads]          = useState<ProductThread[]>([])
  const [loadingThreads, setLoadingT]  = useState(true)
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

  /* ── Load threads for seller ── */
  const loadThreads = useCallback(async () => {
    if (!myOrgId) { setLoadingT(false); return }

    const { data: myProducts } = await supabase
      .from('products')
      .select('id, sku, description')
      .eq('organization_id', myOrgId)

    if (!myProducts?.length) { setThreads([]); setLoadingT(false); return }

    const productIds = (myProducts as { id: string }[]).map(p => p.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productMap: Record<string, { sku: string; description: string }> = {}
    ;(myProducts as { id: string; sku: string; description: string }[]).forEach(p => {
      productMap[p.id] = { sku: p.sku, description: p.description }
    })

    // All messages for seller's products (no session_id filter — includes legacy)
    const { data: msgs } = await supabase
      .from('product_messages')
      .select('product_id, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })

    // Open sessions for seller's products (for reply/close capability)
    const { data: openSessions } = await supabase
      .from('chat_sessions')
      .select('id, product_id, status, sale_price, last_message_from')
      .in('product_id', productIds)
      .order('last_message_at', { ascending: false })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openSessionMap: Record<string, { id: string; status: string; salePrice: number | null; lastFrom: string | null }> = {}
    ;(openSessions ?? []).forEach((s: any) => {
      // Keep the most recent session per product
      if (!openSessionMap[s.product_id]) {
        openSessionMap[s.product_id] = { id: s.id, status: s.status, salePrice: s.sale_price, lastFrom: s.last_message_from }
      }
    })

    const latestAt: Record<string, string> = {}
    const countBy:  Record<string, number> = {}
    ;(msgs ?? []).forEach((m: { product_id: string; created_at: string }) => {
      if (!latestAt[m.product_id]) latestAt[m.product_id] = m.created_at
      countBy[m.product_id] = (countBy[m.product_id] ?? 0) + 1
    })

    // Only show products that have at least one message
    const activeProductIds = productIds.filter(pid => latestAt[pid])

    setThreads(activeProductIds.map(pid => {
      const sess = openSessionMap[pid] ?? null
      return {
        productId:            pid,
        productSku:           productMap[pid]?.sku ?? '',
        productDescription:   productMap[pid]?.description ?? '',
        lastMessageAt:        latestAt[pid] ?? '',
        messageCount:         countBy[pid] ?? 0,
        openSessionId:        sess?.id ?? null,
        openSessionStatus:    sess?.status ?? null,
        openSessionSalePrice: sess?.salePrice ?? null,
      }
    }).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)))

    setLoadingT(false)
  }, [myOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (myOrgId) loadThreads() }, [loadThreads, myOrgId])

  /* ── Load messages for selected product ── */
  const loadMessages = useCallback(async (productId: string) => {
    setLoadingMsgs(true)
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, product_id, session_id, sender_id, sender_org_id, body, created_at')
      .eq('product_id', productId)
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

  function selectThread(productId: string) {
    setSelectedId(productId)
    loadMessages(productId)
    setShowCloseModal(false)
    setCloseReason(null)
    setSalePrice('')
  }

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!selectedId) return
    const ch = supabase
      .channel(`seller-product-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'product_messages',
        filter: `product_id=eq.${selectedId}`,
      }, () => { loadMessages(selectedId); loadThreads() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Send seller message ── */
  async function sendMessage(text: string) {
    if (!selectedId || !user || sending) return
    const currentThread = threads.find(t => t.productId === selectedId)
    if (!currentThread?.openSessionId) return

    setSending(true)
    await supabase.from('product_messages').insert({
      product_id:    selectedId,
      session_id:    currentThread.openSessionId,
      sender_id:     user.id,
      sender_org_id: myOrgId,
      body:          text,
    })
    fetch('/api/chat/notify-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentThread.openSessionId, messageBody: text, senderRole: 'seller' }),
    }).catch(() => {})
    setSending(false)
    await loadMessages(selectedId)
    loadThreads()
  }

  /* ── Close session ── */
  async function handleClose() {
    const currentThread = threads.find(t => t.productId === selectedId)
    if (!currentThread?.openSessionId || !closeReason) return
    if (closeReason === 'agreed' && !salePrice.trim()) return
    setClosing(true)
    await fetch('/api/chat/close-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentThread.openSessionId,
        reason: closeReason,
        ...(closeReason === 'agreed' ? { salePrice: parseFloat(salePrice) } : {}),
      }),
    })
    setClosing(false)
    setShowCloseModal(false)
    setCloseReason(null)
    setSalePrice('')
    await loadThreads()
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

  const currentThread = threads.find(t => t.productId === selectedId) ?? null
  const isOpen = currentThread?.openSessionStatus === 'open'

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

      {/* ── Lista de hilos ── */}
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
            {threads.filter(t => t.openSessionStatus === 'open').length} consultas activas
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingThreads ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Cargando…
            </div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Sin consultas aún</p>
            </div>
          ) : (
            threads.map(t => {
              const needsReply = t.openSessionStatus === 'open'
              const isSelected = t.productId === selectedId
              return (
                <button
                  key={t.productId}
                  onClick={() => selectThread(t.productId)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px',
                    background: isSelected ? 'var(--accent-glow)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                    borderTop: 'none', borderRight: 'none',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {t.productSku}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {fmtTime(t.lastMessageAt)}
                    </span>
                  </div>
                  <p style={{
                    margin: '0 0 5px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.productDescription}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t.openSessionStatus && t.openSessionStatus !== 'open' ? (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: 'var(--text-muted)',
                        background: 'var(--bg-base)', borderRadius: 5, padding: '2px 6px',
                        border: '1px solid var(--border)',
                      }}>
                        <LockIcon />
                        {t.openSessionStatus === 'closed_agreed'
                          ? `Acordado${t.openSessionSalePrice ? ` $${t.openSessionSalePrice.toLocaleString('es-AR')}` : ''}`
                          : 'Sin acuerdo'}
                      </span>
                    ) : needsReply ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                        <ClockIcon /> Responder
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.messageCount} mensajes</span>
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
                {currentThread?.productSku}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {currentThread?.productDescription}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {currentThread?.openSessionStatus && currentThread.openSessionStatus !== 'open' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 7,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text-muted)',
                }}>
                  <LockIcon />
                  {currentThread.openSessionStatus === 'closed_agreed'
                    ? `Acordado${currentThread.openSessionSalePrice ? ` — $${currentThread.openSessionSalePrice.toLocaleString('es-AR')}` : ''}`
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
                <p style={{ margin: 0 }}>Sin mensajes en esta conversación</p>
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

          {/* Botones de respuesta — solo si hay sesión abierta */}
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
              {currentThread?.productSku}
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
