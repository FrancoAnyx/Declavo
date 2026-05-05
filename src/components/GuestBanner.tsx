'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
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
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

const LabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
}

function ApprovedBanner({ requestId, onClear }: { requestId: string; onClear: () => void }) {
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')

  async function handleLogin() {
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/get-login-link?id=${requestId}`)
      let json: { url?: string; error?: string } = {}
      try { json = await res.json() } catch {}
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Servicio no disponible. Intentá en unos minutos.')
        setSending(false)
        return
      }
      window.location.href = json.url
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
      setSending(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)',
      border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      marginBottom: 20, position: 'relative',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)',
      }}>
        <CheckIcon />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
          ¡Tu solicitud fue aprobada!
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {error || 'Hacé clic en "Ingresar" para acceder a la plataforma.'}
        </p>
      </div>
      <button
        onClick={handleLogin}
        disabled={sending}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
          color: '#fff', background: 'rgba(34,197,94,0.8)', border: 'none', flexShrink: 0,
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Cargando…' : 'Ingresar'}
      </button>
      <button onClick={onClear} title="Cerrar" style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
        <XIcon />
      </button>
    </div>
  )
}

const STORAGE_KEY = 'declavo_pending_request'

type RequestStatus = 'pending' | 'approved' | 'rejected'

interface StoredRequest {
  id: string
  email: string
  name: string
  status?: RequestStatus
}

export default function GuestBanner() {
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [sent, setSent]           = useState(false)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' })

  const [storedRequest, setStoredRequest] = useState<StoredRequest | null>(null)
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('pending')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: StoredRequest = JSON.parse(raw)
        if (parsed?.id) {
          setStoredRequest(parsed)
          setRequestStatus(parsed.status ?? 'pending')
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!storedRequest || requestStatus !== 'pending') return

    async function check() {
      try {
        const { data } = await supabase
          .from('access_requests')
          .select('status')
          .eq('id', storedRequest!.id)
          .single()
        const s = data?.status as RequestStatus | undefined
        if (s === 'approved' || s === 'rejected') {
          setRequestStatus(s)
          const updated = { ...storedRequest, status: s }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          setStoredRequest(updated)
        }
      } catch {}
    }

    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [storedRequest, requestStatus])

  function clearPendingRequest() {
    localStorage.removeItem(STORAGE_KEY)
    setStoredRequest(null)
  }

  async function handleSend() {
    if (!form.email || !form.name) return
    setSending(true)
    setError('')

    const requestId = crypto.randomUUID()
    const { error: e } = await supabase.from('access_requests').insert({
      id:      requestId,
      name:    form.name.trim(),
      email:   form.email.trim().toLowerCase(),
      company: form.company.trim() || null,
      message: form.message.trim() || null,
    })
    setSending(false)
    if (e) { setError('No se pudo enviar la solicitud. Intentá de nuevo.'); return }

    // Notificar al admin por email (fire & forget)
    fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:      form.name.trim(),
        email:     form.email.trim().toLowerCase(),
        company:   form.company.trim() || undefined,
        requestId,
      }),
    }).catch(() => {})

    const newRequest: StoredRequest = {
      id: requestId,
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequest))
    setStoredRequest(newRequest)
    setRequestStatus('pending')
    setSent(true)
    setTimeout(() => setShowModal(false), 3000)
  }

  if (dismissed) return null

  if (storedRequest) {
    if (requestStatus === 'approved') {
      return <ApprovedBanner requestId={storedRequest.id} onClear={clearPendingRequest} />
    }

    if (requestStatus === 'rejected') {
      return (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 20, position: 'relative',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
              Tu solicitud de acceso no fue aprobada.
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Si tenés dudas, contactanos directamente.
            </p>
          </div>
          <button onClick={clearPendingRequest} title="Cerrar" style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <XIcon />
          </button>
        </div>
      )
    }

    return (
      <div style={{
        background: 'linear-gradient(135deg, var(--accent-glow) 0%, rgba(167,139,250,0.07) 100%)',
        border: '1px solid var(--border-accent)', borderRadius: 14,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 20, position: 'relative',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
        }}>
          <ClockIcon />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            Tu solicitud está en revisión
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            El equipo de Declavo la revisará a la brevedad. Quedate en la página o volvé más tarde.
          </p>
        </div>
        <button onClick={clearPendingRequest} title="Cerrar" style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <XIcon />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent-glow) 0%, rgba(167,139,250,0.07) 100%)',
        border: '1px solid var(--border-accent)', borderRadius: 14,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        marginBottom: 20, position: 'relative',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            ¿Sos parte del ecosistema tech?
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Pedile a tu reseller de confianza que se comunique con nosotros, o solicitá acceso directamente.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff', background: 'var(--accent)',
            border: 'none', transition: 'all 0.18s', boxShadow: '0 0 16px var(--accent-glow)', flexShrink: 0,
          }}
        >
          <MailIcon /> Solicitar acceso
        </button>
        <button
          onClick={() => setDismissed(true)}
          title="Cerrar"
          style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <XIcon />
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20,
            width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-card)',
            animation: 'modalIn 0.24s cubic-bezier(0.34,1.4,0.64,1) both',
          }}>
            {sent ? (
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                  <CheckIcon />
                </div>
                <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 8px', color: 'var(--text-primary)' }}>¡Solicitud enviada!</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Recibimos tu solicitud. El equipo de Declavo<br />la revisará a la brevedad.
                </p>
              </div>
            ) : (
              <>
                <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Solicitar acceso</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                      Completá el formulario y el equipo de Declavo te dará acceso.
                    </p>
                  </div>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, marginTop: 2 }}><XIcon /></button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={LabelStyle}>Nombre completo *</label>
                      <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan García" />
                    </div>
                    <div>
                      <label style={LabelStyle}>Email *</label>
                      <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="tu@empresa.com" />
                    </div>
                  </div>
                  <div>
                    <label style={LabelStyle}>Empresa</label>
                    <input className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="TechDistribuidora SA" />
                  </div>
                  <div>
                    <label style={LabelStyle}>Contanos sobre tu empresa</label>
                    <textarea
                      className="input"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="¿A qué se dedica tu empresa? ¿Qué productos o marcas trabajan? ¿Cómo conociste Declavo?"
                      rows={3}
                      style={{ resize: 'vertical', minHeight: 72 }}
                    />
                  </div>
                  {error && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                      {error}
                    </div>
                  )}
                </div>

                <div style={{ padding: '14px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{ padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!form.email || !form.name || sending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      cursor: (!form.email || !form.name || sending) ? 'not-allowed' : 'pointer',
                      opacity: (!form.email || !form.name || sending) ? 0.5 : 1,
                      color: '#fff', background: 'var(--accent)', border: 'none', transition: 'all 0.18s',
                    }}
                  >
                    <MailIcon /> {sending ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
