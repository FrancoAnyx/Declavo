'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [ready,    setReady]    = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    setError('')
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return }
    if (password !== confirm)  { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) { setError(e.message); setSaving(false); return }
    router.replace('/catalogo')
  }

  if (!ready) return null

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0b14', padding: 16,
    }}>
      <div style={{
        background: '#12142a', border: '1px solid #2a2c45', borderRadius: 20,
        padding: '36px 28px', width: '100%', maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#7c6ff7', display: 'inline-block', boxShadow: '0 0 10px #7c6ff7' }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#e0e0f0', letterSpacing: '-0.5px', fontFamily: 'Syne, sans-serif' }}>Declavo</span>
        </div>

        <h1 style={{ color: '#e0e0f0', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
          Creá tu contraseña
        </h1>
        <p style={{ color: '#9898b8', fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
          Con esta contraseña podés ingresar a Declavo en cualquier momento.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Contraseña
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5a5a7a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !password || !confirm}
            style={{
              padding: '11px 20px', borderRadius: 10, border: 'none',
              cursor: saving || !password || !confirm ? 'not-allowed' : 'pointer',
              background: '#7c6ff7', color: '#fff', fontSize: 14, fontWeight: 600,
              opacity: saving || !password || !confirm ? 0.5 : 1,
              marginTop: 4, transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar contraseña e ingresar →'}
          </button>

          <button
            onClick={() => router.replace('/catalogo')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#5a5a7a', fontSize: 12, padding: 0, textDecoration: 'underline',
            }}
          >
            Omitir por ahora (usaré link por email)
          </button>
        </div>
      </div>
    </div>
  )
}
