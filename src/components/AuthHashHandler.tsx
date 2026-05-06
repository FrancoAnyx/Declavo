'use client'

import { useEffect } from 'react'

/**
 * Detecta tokens de Supabase en el hash de la URL (implicit flow) y redirige
 * al callback correcto cuando Supabase manda el usuario directo a /catalogo
 * en vez de /auth/callback (sucede si la redirect URL configurada no coincide).
 */
export default function AuthHashHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    // Determinar a dónde redirigir según el tipo de link
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const type = params.get('type')
    const next = type === 'invite' ? '/set-password' : '/catalogo'

    // Redirigir a /auth/callback manteniendo los tokens en el hash
    window.location.replace(`/auth/callback?next=${next}${hash}`)
  }, [])

  return null
}
