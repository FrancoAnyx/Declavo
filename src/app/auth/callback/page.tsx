'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthCallbackInner() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const next     = searchParams.get('next') ?? '/catalogo'

    async function handle() {
      // PKCE flow: code in query params
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { router.replace(next); return }
      }

      // Implicit flow: hash tokens (#access_token=…)
      // createBrowserClient processes the hash automatically on init.
      // We wait one tick to let it settle.
      await new Promise(r => setTimeout(r, 400))
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { router.replace(next); return }

      // Nothing worked
      setFailed(true)
      setTimeout(() => router.replace('/'), 3500)
    }

    handle()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0b14', color: '#9898b8',
      fontFamily: 'var(--font-body, sans-serif)', gap: 14,
    }}>
      {failed ? (
        <>
          <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 15 }}>El link expiró o no es válido.</p>
          <p style={{ fontSize: 13 }}>Redirigiendo…</p>
        </>
      ) : (
        <>
          <div style={{
            width: 36, height: 36,
            border: '3px solid #7c6ff7', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14 }}>Iniciando sesión…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
      )}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  )
}
