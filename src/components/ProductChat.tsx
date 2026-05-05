'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'
import type { ChatSessionStatus } from '@/types/database'

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function ChatBubbleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

const BUYER_MESSAGES = [
  '¿Cuál es el precio?',
  '¿Tienen stock disponible?',
  '¿Cuáles son las condiciones de pago?',
  'Necesito mayor cantidad de la publicada',
  '¿Tienen garantía?',
  'Me interesa — ¿cómo seguimos?',
]

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

interface SessionInfo {
  id: string
  status: ChatSessionStatus
  sale_price: number | null
  closed_at: string | null
}

interface Props {
  productId: string
  productName: string
  onClose: () => void
}

export default function ProductChat({ productId, productName, onClose }: Props) {
  const supabase = createClient()
  const { user } = useProfile()

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  // Modal de cierre
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReason, setCloseReason] = useState<'no_deal' | 'agreed' | null>(null)
  const [salePrice, setSalePrice] = useState('')
  const [closing, setClosing] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const myOrgId = user?.organization?.id ?? null

  // Carga la sesión más reciente para este producto + mi empresa
  const loadSession = useCallback(async () => {
    if (!myOrgId) { setSessionLoading(false); return }

    const { data } = await supabase
      .from('chat_sessions')
      .select('id, status, sale_price, closed_at')
      .eq('product_id', productId)
      .eq('buyer_org_id', myOrgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setSession(data as SessionInfo | null)
    setSessionLoading(false)
  }, [productId, myOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSession() }, [loadSession])

  const fetchMessages = useCallback(async (sid: string) => {
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, product_id, session_id, sender_id, sender_org_id, body, created_at')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })

    if (!rawMsgs || rawMsgs.length === 0) {
      setMessages([])
      setMessagesLoading(false)
      return
    }

    const orgIds = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_org_id).filter(Boolean))] as string[]
    const { data: orgs } = orgIds.length > 0
      ? await supabase.from('organizations').select('id, name').in('id', orgIds)
      : { data: [] }

    const orgMap: Record<string, string> = {}
    ;(orgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setMessages((rawMsgs as RawMessage[]).map(m => ({
      ...m,
      sender_org_name: m.sender_org_id ? (orgMap[m.sender_org_id] ?? null) : null,
      is_mine: m.sender_org_id === myOrgId,
    })))
    setMessagesLoading(false)
  }, [myOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Suscripción a la sesión actual
  useEffect(() => {
    if (!session?.id) return
    setMessagesLoading(true)
    fetchMessages(session.id)

    const ch = supabase
      .channel(`chat-session-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'product_messages',
        filter: `session_id=eq.${session.id}`,
      }, () => fetchMessages(session.id))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'chat_sessions',
        filter: `id=eq.${session.id}`,
      }, () => loadSession())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createNewSession() {
    setCreatingSession(true)
    const res = await fetch('/api/chat/open-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })
    const data = await res.json()
    if (data.sessionId) {
      await loadSession()
    }
    setCreatingSession(false)
  }

  async function sendMessage(text: string) {
    if (!text.trim() || !user || sending) return

    // Si no hay sesión abierta, crear una primero
    let sid = session?.id
    if (!sid || session?.status !== 'open') {
      setCreatingSession(true)
      const res = await fetch('/api/chat/open-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json()
      if (!data.sessionId) {
        setChatError(data.error ?? 'No se pudo iniciar la consulta')
        setCreatingSession(false)
        return
      }
      setChatError(null)
      sid = data.sessionId
      await loadSession()
      setCreatingSession(false)
    }

    setSending(true)

    await supabase.from('product_messages').insert({
      product_id:    productId,
      session_id:    sid,
      sender_id:     user.id,
      sender_org_id: myOrgId,
      body:          text.trim(),
    })

    fetch('/api/chat/notify-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, messageBody: text.trim(), senderRole: 'buyer' }),
    }).catch(() => {})

    setSending(false)
    await fetchMessages(sid)
  }

  async function handleCloseSession() {
    if (!session?.id || !closeReason) return
    if (closeReason === 'agreed' && !salePrice.trim()) return

    setClosing(true)
    await fetch('/api/chat/close-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        reason: closeReason,
        ...(closeReason === 'agreed' ? { salePrice: parseFloat(salePrice) } : {}),
      }),
    })
    setClosing(false)
    setShowCloseModal(false)
    setCloseReason(null)
    setSalePrice('')
    await loadSession()
  }

  const fmt     = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
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

  const isOpen   = session?.status === 'open'
  const isClosed = session && session.status !== 'open'
  const agreedLabel = session?.status === 'closed_agreed'
    ? `Cerrado con acuerdo${session.sale_price ? ` — $${session.sale_price.toLocaleString('es-AR')}` : ''}`
    : 'Cerrado sin acuerdo'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal principal */}
      <div style={{
        width: '100%', maxWidth: 680,
        height: 'min(700px, 90vh)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-card), 0 24px 80px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-surface)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
          }}>
            <ChatBubbleIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Chat del producto
            </p>
            <p style={{
              margin: 0, fontSize: 12, color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {productName}
            </p>
          </div>

          {/* Botón cerrar sesión (solo si está abierta) */}
          {isOpen && session && (
            <button
              onClick={() => setShowCloseModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)',
                color: '#dc3545', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <LockIcon /> Finalizar
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-base)', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            <XIcon />
          </button>
        </div>

        {/* Aviso de sesión cerrada */}
        {isClosed && (
          <div style={{
            padding: '10px 20px',
            background: 'rgba(124,111,247,0.08)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}><AlertIcon /></span>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
              Esta consulta fue <strong style={{ color: 'var(--text-secondary)' }}>{agreedLabel}</strong>. Solo lectura.
            </p>
            <button
              onClick={createNewSession}
              disabled={creatingSession}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, flexShrink: 0,
                background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: creatingSession ? 0.5 : 1,
              }}
            >
              <PlusIcon /> Nueva consulta
            </button>
          </div>
        )}

        {/* Mensajes */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {sessionLoading || messagesLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 32 }}>
              Cargando…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Sin mensajes aún
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>
                {user ? 'Seleccioná una consulta de los botones de abajo.' : 'Iniciá sesión para consultar.'}
              </p>
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
                  const senderLabel = m.is_mine ? 'Vos' : (m.sender_org_name ?? 'Vendedor')
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
                        {senderLabel}
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
                        {fmt(m.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Zona de interacción */}
        {!user ? (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
              <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Iniciá sesión</a> para enviar consultas
            </p>
          </div>
        ) : isClosed ? null : !myOrgId ? (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Tu cuenta no tiene una empresa asignada. Contactá al administrador.
            </p>
          </div>
        ) : (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            padding: '14px 18px',
          }}>
            {chatError && (
              <div style={{
                marginBottom: 10, padding: '9px 12px', borderRadius: 9,
                background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.3)',
                color: '#dc3545', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertIcon /> {chatError}
              </div>
            )}
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Seleccioná tu consulta
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {BUYER_MESSAGES.map(msg => (
                <button
                  key={msg}
                  onClick={() => sendMessage(msg)}
                  disabled={sending || creatingSession}
                  style={{
                    padding: '9px 12px', borderRadius: 9,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.35,
                    transition: 'all 0.15s',
                    opacity: (sending || creatingSession) ? 0.5 : 1,
                  }}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de finalización */}
      {showCloseModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 600,
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
            animation: 'modalIn 0.18s cubic-bezier(0.34,1.4,0.64,1) both',
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Finalizar consulta
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
              ¿Cómo terminó esta consulta?
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
                  Precio de venta acordado
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
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
                onClick={handleCloseSession}
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
