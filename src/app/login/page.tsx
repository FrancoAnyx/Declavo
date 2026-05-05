'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }
    router.push('/catalogo')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            Declavo
          </span>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            Iniciar sesión
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>
            Acceso exclusivo por invitación
          </p>

          {/* Aclaración sobre credenciales */}
          <div style={{
            marginBottom: 20, padding: '10px 14px', borderRadius: 10,
            background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>¿Cómo son tus credenciales?</strong><br />
            El <strong>email de acceso</strong> es el que el administrador usó para invitarte.<br />
            El <strong>nombre</strong> que elegiste al registrarte es solo para identificarte en la plataforma.
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Email de acceso
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="el email con el que te invitaron"
                required
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 12,
                background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                color: 'var(--danger)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 4, fontSize: 14 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ingresar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          ¿No tenés acceso? Pedile una invitación al administrador.
        </p>
      </div>
    </div>
  )
}
