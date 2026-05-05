'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
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
function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

const QUICK_MESSAGES = [
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
  sender_id: string
  sender_org_id: string | null
  body: string
  created_at: string
}
interface DisplayMessage extends RawMessage {
  sender_name: string
  sender_org_name: string | null
}

interface Props {
  productId: string
  productName: string
  onClose: () => void
}

export default function ProductChat({ productId, productName, onClose }: Props) {
  const supabase = createClient()
  const { user } = useProfile()
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [customText, setCustomText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const fetchMessages = useCallback(async () => {
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, product_id, sender_id, sender_org_id, body, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: true })

    if (!rawMsgs || rawMsgs.length === 0) { setMessages([]); setLoading(false); return }

    const senderIds = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_id))]
    const orgIds    = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_org_id).filter(Boolean))] as string[]

    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', senderIds),
      orgIds.length > 0
        ? supabase.from('organizations').select('id, name').in('id', orgIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profileMap[p.id] = p.full_name ?? 'Usuario'
    })
    const orgMap: Record<string, string> = {}
    ;(orgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setMessages((rawMsgs as RawMessage[]).map(m => ({
      ...m,
      sender_name:     profileMap[m.sender_id] ?? 'Usuario',
      sender_org_name: m.sender_org_id ? (orgMap[m.sender_org_id] ?? null) : null,
    })))
    setLoading(false)
  }, [productId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages()
    const ch = supabase
      .channel(`chat-${productId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'product_messages',
        filter: `product_id=eq.${productId}`,
      }, () => fetchMessages())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchMessages, productId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim() || !user) return
    setSending(true)
    await supabase.from('product_messages').insert({
      product_id:    productId,
      sender_id:     user.id,
      sender_org_id: user.profile?.organization_id ?? null,
      body:          text.trim(),
    })
    setCustomText('')
    setCustomMode(false)
    setSending(false)
    // Refresco inmediato para que aparezca el mensaje sin esperar el realtime
    await fetchMessages()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(customText) }
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

  return (
    /* Overlay */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal */}
      <div style={{
        width: '100%', maxWidth: 680,
        height: 'min(680px, 88vh)',
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

        {/* Mensajes */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 32 }}>
              Cargando mensajes…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Sin mensajes aún
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>
                Usá los botones de abajo para hacer tu consulta.
              </p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.date}>
                {/* Separador de fecha */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', padding: '0 6px' }}>
                    {fmtDate(group.msgs[0].created_at)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                {group.msgs.map(m => {
                  const isMe = m.sender_id === user?.id
                  // Mostrar nombre de empresa (anónimo a nivel persona)
                  const senderLabel = isMe
                    ? 'Vos'
                    : (m.sender_org_name ?? 'Consulta anónima')
                  return (
                    <div key={m.id} style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 12,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                        marginBottom: 4,
                        padding: isMe ? '0 4px 0 0' : '0 0 0 4px',
                      }}>
                        {senderLabel}
                      </span>
                      <div style={{
                        maxWidth: '78%', padding: '10px 14px',
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? 'var(--accent)' : 'var(--bg-base)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>
                        {m.body}
                      </div>
                      <span style={{
                        fontSize: 10, color: 'var(--text-muted)', marginTop: 3,
                        padding: isMe ? '0 4px 0 0' : '0 0 0 4px',
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
        {user ? (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            padding: '14px 18px',
          }}>
            {customMode ? (
              /* Input libre cuando se elige "Escribir consulta" */
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  autoFocus
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribí tu consulta… (Enter para enviar)"
                  rows={2}
                  style={{
                    flex: 1, resize: 'none', border: '1px solid var(--border-accent)',
                    borderRadius: 10, padding: '9px 12px', fontSize: 14,
                    background: 'var(--bg-base)', color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.45,
                    maxHeight: 100, overflowY: 'auto',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => sendMessage(customText)}
                    disabled={!customText.trim() || sending}
                    style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: customText.trim() ? 'var(--accent)' : 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: customText.trim() ? '#fff' : 'var(--text-muted)',
                      cursor: customText.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <SendIcon />
                  </button>
                  <button
                    onClick={() => { setCustomMode(false); setCustomText('') }}
                    style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
                    }}
                    title="Volver a botones"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
            ) : (
              /* Botones predefinidos */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Seleccioná tu consulta
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {QUICK_MESSAGES.map(msg => (
                    <button
                      key={msg}
                      onClick={() => sendMessage(msg)}
                      disabled={sending}
                      style={{
                        padding: '9px 12px', borderRadius: 9,
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        background: 'var(--bg-base)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.35,
                        transition: 'all 0.15s',
                        opacity: sending ? 0.5 : 1,
                      }}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
                {/* Botón consulta libre */}
                <button
                  onClick={() => { setCustomMode(true); setTimeout(() => inputRef.current?.focus(), 50) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 14px', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                    color: 'var(--accent)', transition: 'all 0.15s', marginTop: 2,
                  }}
                >
                  <EditIcon /> Escribir consulta personalizada…
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
              <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Iniciá sesión</a> para enviar consultas
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
