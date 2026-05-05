'use client'

import { useState } from 'react'

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polyline points="2,4 12,13 22,4"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function GuestBanner() {
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail]         = useState('')
  const [company, setCompany]     = useState('')
  const [name, setName]           = useState('')
  const [sent, setSent]           = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  function handleSend() {
    if (!email || !name) return
    const subject = encodeURIComponent('Solicitud de acceso a Declavo')
    const body    = encodeURIComponent(
      `Hola,\n\nMe gustaría solicitar acceso a Declavo.\n\nNombre: ${name}\nEmpresa: ${company}\nEmail: ${email}\n\n¿Podrían enviarme una invitación?\n\nGracias.`
    )
    window.location.href = `mailto:comercial3@anyx.com.ar?subject=${subject}&body=${body}`
    setSent(true)
    setTimeout(() => setShowModal(false), 2000)
  }

  return (
    <>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent-glow) 0%, rgba(167,139,250,0.08) 100%)',
        border: '1px solid var(--border-accent)',
        borderRadius: 14,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        marginBottom: 20,
        position: 'relative',
      }}>
        {/* Ícono decorativo */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            ¿Sos parte del ecosistema tech?
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Pedile a tu reseller de confianza que se comunique con nosotros para conseguir tu acceso.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            color: '#fff', background: 'var(--accent)',
            border: 'none', transition: 'all 0.18s',
            boxShadow: '0 0 16px var(--accent-glow)',
            flexShrink: 0,
          }}
        >
          <MailIcon /> Solicitar acceso
        </button>

        {/* Cerrar */}
        <button
          onClick={() => setDismissed(true)}
          title="Cerrar"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 26, height: 26, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'all 0.15s',
          }}
        >
          <XIcon />
        </button>
      </div>

      {/* Modal solicitud */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 20, width: '100%', maxWidth: 420,
            boxShadow: 'var(--shadow-card)',
            animation: 'modalIn 0.24s cubic-bezier(0.34,1.4,0.64,1) both',
          }}>
            {sent ? (
              <div style={{ padding: '40px 32px', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--success)',
                }}>
                  <CheckIcon />
                </div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px', color: 'var(--text-primary)' }}>¡Solicitud enviada!</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Te contactaremos a la brevedad.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Solicitar acceso</h2>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Te enviamos una invitación por email</p>
                  </div>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><XIcon /></button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Nombre completo *
                    </label>
                    <input
                      className="input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Juan García"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Email *
                    </label>
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@empresa.com"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Empresa
                    </label>
                    <input
                      className="input"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="TechDistribuidora SA"
                    />
                  </div>
                </div>

                <div style={{ padding: '14px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', transition: 'all 0.18s',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!email || !name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      cursor: !email || !name ? 'not-allowed' : 'pointer',
                      opacity: !email || !name ? 0.5 : 1,
                      color: '#fff', background: 'var(--accent)', border: 'none',
                      transition: 'all 0.18s',
                    }}
                  >
                    <MailIcon /> Enviar solicitud
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
