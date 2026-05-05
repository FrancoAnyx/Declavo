'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'
import { Loader2 } from 'lucide-react'

function SendIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
}
function ChatIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}

interface Thread {
  product_id: string
  sku: string
  product_description: string
  last_body: string
  last_at: string
  msg_count: number
  last_sender_org: string | null
  has_external: boolean // recibió mensajes de otra empresa
}

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

export default function MisChatsPage() {
  const supabase = createClient()
  const { user } = useProfile()
  const orgId    = user?.profile?.organization_id

  const [threads, setThreads]           = useState<Thread[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages]         = useState<DisplayMessage[]>([])
  const [msgLoading, setMsgLoading]     = useState(false)
  const [body, setBody]                 = useState('')
  const [sending, setSending]           = useState(false)
  const bottomRef                       = useRef<HTMLDivElement>(null)
  const inputRef                        = useRef<HTMLTextAreaElement>(null)

  // Cargar hilos: productos de mi empresa que tienen mensajes
  const fetchThreads = useCallback(async () => {
    if (!orgId) return
    setLoading(true)

    // Obtener todos los mensajes sobre productos de nuestra empresa
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, description')
      .eq('organization_id', orgId)

    if (!products || products.length === 0) { setLoading(false); return }

    const productIds = products.map((p: { id: string }) => p.id)
    const productMap: Record<string, { sku: string; description: string }> = {}
    products.forEach((p: { id: string; sku: string; description: string }) => {
      productMap[p.id] = { sku: p.sku, description: p.description }
    })

    const { data: msgs } = await supabase
      .from('product_messages')
      .select('id, product_id, sender_id, sender_org_id, body, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) { setLoading(false); return }

    // Agrupar por producto
    const threadMap: Record<string, Thread> = {}
    ;(msgs as RawMessage[]).forEach(m => {
      const prod = productMap[m.product_id]
      if (!prod) return
      if (!threadMap[m.product_id]) {
        threadMap[m.product_id] = {
          product_id: m.product_id,
          sku: prod.sku,
          product_description: prod.description,
          last_body: m.body,
          last_at: m.created_at,
          msg_count: 0,
          last_sender_org: m.sender_org_id,
          has_external: m.sender_org_id !== orgId,
        }
      }
      threadMap[m.product_id].msg_count++
      if (m.sender_org_id !== orgId) threadMap[m.product_id].has_external = true
    })

    setThreads(Object.values(threadMap).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()))
    setLoading(false)
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // Cargar mensajes del hilo activo
  const fetchMessages = useCallback(async (productId: string) => {
    setMsgLoading(true)
    const { data: rawMsgs } = await supabase
      .from('product_messages')
      .select('id, product_id, sender_id, sender_org_id, body, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: true })

    if (!rawMsgs || rawMsgs.length === 0) { setMessages([]); setMsgLoading(false); return }

    const senderIds = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_id))]
    const orgIds    = [...new Set((rawMsgs as RawMessage[]).map(m => m.sender_org_id).filter(Boolean))] as string[]

    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', senderIds),
      orgIds.length > 0 ? supabase.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
    ])

    const profileMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => { profileMap[p.id] = p.full_name ?? 'Usuario' })
    const orgMap: Record<string, string> = {}
    ;(orgs ?? []).forEach((o: { id: string; name: string }) => { orgMap[o.id] = o.name })

    setMessages((rawMsgs as RawMessage[]).map(m => ({
      ...m,
      sender_name:     profileMap[m.sender_id] ?? 'Usuario',
      sender_org_name: m.sender_org_id ? (orgMap[m.sender_org_id] ?? null) : null,
    })))
    setMsgLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeThread) return
    fetchMessages(activeThread.product_id)

    const ch = supabase
      .channel(`mis-chats-${activeThread.product_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_messages', filter: `product_id=eq.${activeThread.product_id}` }, () => {
        fetchMessages(activeThread.product_id)
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeThread, fetchMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!body.trim() || !user || !activeThread) return
    setSending(true)
    await supabase.from('product_messages').insert({
      product_id:    activeThread.product_id,
      sender_id:     user.id,
      sender_org_id: orgId ?? null,
      body:          body.trim(),
    })
    setBody('')
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return 'ahora'
    if (diff < 60) return `${diff} min`
    if (diff < 1440) return `${Math.floor(diff/60)} h`
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  if (!orgId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 14 }}>
      Tu usuario no tiene empresa asignada.
    </div>
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* Panel izquierdo: lista de hilos */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        background: 'var(--bg-surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}>
            Mis Chats
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Consultas sobre tus productos
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <p style={{ fontSize: 13, margin: 0 }}>Sin conversaciones aún</p>
          </div>
        ) : (
          threads.map(t => (
            <button
              key={t.product_id}
              onClick={() => { setActiveThread(t); setBody('') }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                background: activeThread?.product_id === t.product_id ? 'var(--accent-glow)' : 'transparent',
                borderLeft: activeThread?.product_id === t.product_id ? '3px solid var(--accent)' : '3px solid transparent',
                border: 'none', borderBottom: '1px solid var(--border)', transition: 'all 0.15s',
                width: '100%',
              }}
            >
              {/* Avatar producto */}
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: t.has_external ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: `1px solid ${t.has_external ? 'var(--border-accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.has_external ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                <ChatIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.3px' }}>
                    {t.sku}
                  </p>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(t.last_at)}</span>
                </div>
                <p style={{ margin: '1px 0 2px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.product_description}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.last_body}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.msg_count} mensaje{t.msg_count !== 1 ? 's' : ''}</span>
                  {t.has_external && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', color: 'var(--accent)' }}>
                      Nueva consulta
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Panel derecho: conversación activa */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        {!activeThread ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              Centro de chats
            </h2>
            <p style={{ fontSize: 14, margin: 0 }}>Seleccioná una conversación para responder</p>
          </div>
        ) : (
          <>
            {/* Header conversación */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.3px' }}>{activeThread.sku}</p>
                <p style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{activeThread.product_description}</p>
              </div>
            </div>

            {/* Mensajes */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msgLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                  <p style={{ fontSize: 13, margin: 0 }}>Sin mensajes aún.</p>
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.sender_org_id === orgId
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, padding: isMe ? '0 4px 0 0' : '0 0 0 4px' }}>
                        {isMe ? 'Tu empresa' : (m.sender_org_name ?? m.sender_name)}
                      </span>
                      <div style={{
                        maxWidth: '70%', padding: '10px 14px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? 'var(--accent)' : 'var(--bg-card)',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>
                        {m.body}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, padding: isMe ? '0 4px 0 0' : '0 0 0 4px' }}>{fmtTime(m.created_at)}</span>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input respuesta */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Respondé la consulta… (Enter para enviar)"
                rows={1}
                style={{
                  flex: 1, resize: 'none', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '10px 14px', fontSize: 14,
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!body.trim() || sending}
                style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: body.trim() ? 'var(--accent)' : 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: body.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: body.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.18s',
                }}
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
