'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, Loader2, CheckCircle, XCircle } from 'lucide-react'

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'done'

export default function InvitePage() {
  const params   = useParams()
  const router   = useRouter()
  const token    = params.token as string
  const supabase = createClient()

  const [status, setStatus]   = useState<InviteStatus>('loading')
  const [orgName, setOrgName] = useState('')
  const [form, setForm]       = useState({ fullName: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function checkToken() {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, organizations(name)')
        .eq('token', token)
        .single()

      if (error || !data) { setStatus('invalid'); return }
      if (data.accepted_at)   { setStatus('accepted'); return }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return }

      setOrgName((data.organizations as { name: string } | null)?.name ?? '')
      setStatus('valid')
    }
    checkToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setSubmitting(true)

    // Get invitation email
    const { data: inv } = await supabase
      .from('invitations')
      .select('email')
      .eq('token', token)
      .single()

    if (!inv) { setError('Invitación inválida.'); setSubmitting(false); return }

    const { error: signUpError } = await supabase.auth.signUp({
      email: inv.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          invitation_token: token,
        },
      },
    })

    if (signUpError) {
      // Maybe already registered — try sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inv.email,
        password: form.password,
      })
      if (signInError) { setError('Error al crear la cuenta. Intentá de nuevo.'); setSubmitting(false); return }
    }

    setStatus('done')
    setTimeout(() => router.push('/catalogo'), 2000)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }

  if (status === 'invalid' || status === 'expired' || status === 'accepted') {
    const messages: Record<string, { title: string; sub: string }> = {
      invalid:  { title: 'Invitación inválida',   sub: 'Este link no existe o ya fue usado.' },
      expired:  { title: 'Invitación expirada',   sub: 'El link venció. Pedí una nueva invitación al administrador.' },
      accepted: { title: 'Ya registrado',         sub: 'Esta invitación ya fue aceptada. Podés iniciar sesión.' },
    }
    const msg = messages[status]
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <XCircle size={40} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-base font-medium mb-1">{msg.title}</h2>
          <p className="text-sm text-brand-400 mb-4">{msg.sub}</p>
          <a href="/login" className="btn btn-primary justify-center w-full">Ir al login</a>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <CheckCircle size={40} className="mx-auto mb-4 text-green-600" />
          <h2 className="text-base font-medium mb-1">¡Bienvenido a Declavo!</h2>
          <p className="text-sm text-brand-400">Redirigiendo al catálogo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-brand-900 rounded-lg flex items-center justify-center">
            <LayoutGrid size={16} className="text-white" />
          </div>
          <span className="text-xl font-medium text-brand-900">Declavo</span>
        </div>

        <div className="card p-6">
          <h1 className="text-[17px] font-medium mb-1">Crear tu cuenta</h1>
          <p className="text-sm text-brand-400 mb-6">
            Fuiste invitado a unirte a <strong className="text-brand-900">{orgName}</strong>
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label">Nombre completo</label>
              <input
                type="text"
                className="input"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Juan García"
                required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input
                type="password"
                className="input"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repetir contraseña"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full justify-center h-9 mt-1"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Crear cuenta y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
