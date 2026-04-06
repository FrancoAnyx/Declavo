'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/context/ProfileContext'
import type { ProductMessage } from '@/types/database'

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

interface Props {
  productId: string
  productName: string
  onClose: () => void
}

interface MessageWithMeta extends ProductMessage {
  sender_name?: string | null
  sender_org_name?: string | null
}

export default function ProductChat({ productId, productName, onClose }: Props) {
  const supabase        = createClient()
  const { user }        = useProfile()
  const [messages, setMessages] = useState<MessageWithMeta[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('product_messages')
      .select(`
        *,
        profiles!product_messages_sender_id_fkey(full_name),
        organizations!product_messages_sender_org_id_fkey(name)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: true })

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages(data.map((m: any) => ({
        ...m,
        sender_name:     m.profiles?.full_name ?? 'Usuario',
        sender_org_name: m.organizations?.name ?? null,
      })))
    }
    setLoading(false)
  }, [productId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMessages()

    // Suscripción realtime
    const channel = supabase
      .channel(`product-chat-${productId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'product_messages',
        filter: `product_id=eq.${productId}`,
      }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchMessages, productId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!body.trim() || !user) return
    setSending(true)
    await supabase.from('product_messages').insert({
      product_id:    productId,
      sender_id:     user.id,
      sender_org_id: user.profile?.organization_id ?? null,
      body:          body.trim(),
    })
    setBody('')
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  // Agrupar mensajes por día
  const grouped: { date: string; msgs: MessageWithMeta[] }[] = []
  messages.forEach(m => {
    const d = new Date(m.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== d) grouped.push({ date: d, msgs: [m] })
    else last.msgs.push(m)
  })

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      width: 360, maxHeight: 520,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 18, boxShadow: 'var(--shadow-card), 0 0 40px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column',
      animation: 'modalIn 0.24s cubic-bezier(0.34,1.4,0.64,1) both',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
        }}>
          <ChatIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Consulta sobre producto</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {productName}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          <XIcon />
        </button>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 200, maxHeight: 340 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 20 }}>Cargando mensajes…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p style={{ margin: 0 }}>Sé el primero en preguntar sobre este producto.</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              {/* Separador de fecha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatDate(group.msgs[0].created_at)}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {group.msgs.map(m => {
                const isMe = m.sender_id === user?.id
                return (
                  <div key={m.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                  }}>
                    {/* Remitente */}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                      {isMe ? 'Vos' : (m.sender_org_name ?? m.sender_name ?? 'Usuario')}
                    </span>
                    {/* Burbuja */}
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? 'var(--accent)' : 'var(--bg-base)',
                      border: isMe ? 'none' : '1px solid var(--border)',
                      color: isMe ? '#fff' : 'var(--text-primary)',
                      fontSize: 13, lineHeight: 1.45,
                    }}>
                      {m.body}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, paddingLeft: isMe ? 0 : 2 }}>
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {user ? (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu consulta… (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 12px', fontSize: 13,
              background: 'var(--bg-base)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
              maxHeight: 80, overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: !body.trim() ? 'var(--bg-base)' : 'var(--accent)',
              border: '1px solid var(--border)',
              color: !body.trim() ? 'var(--text-muted)' : '#fff',
              cursor: !body.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s',
            }}
          >
            <SendIcon />
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Iniciá sesión</a> para enviar mensajes
          </p>
        </div>
      )}
    </div>
  )
}
