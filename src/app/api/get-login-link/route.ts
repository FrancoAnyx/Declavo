import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    if (!supabaseUrl) return NextResponse.json({ error: 'Falta NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 })

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: request, error: dbError } = await admin
      .from('access_requests')
      .select('email, status')
      .eq('id', id)
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    if (request.status !== 'approved') return NextResponse.json({ error: 'Solicitud no aprobada' }, { status: 403 })

    // Use NEXT_PUBLIC_SITE_URL first; fall back to host header (origin is not sent for same-origin GET)
    const origin = process.env.NEXT_PUBLIC_SITE_URL
      ?? `https://${req.headers.get('host') ?? 'www.declavo.com.ar'}`

    console.log('[get-login-link] origin:', origin, '| email:', request.email)

    // Call Supabase REST API directly
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: request.email,
        redirect_to: `${origin}/auth/callback?next=/catalogo`,
      }),
    })

    const rawText = await linkRes.text()
    let linkData: Record<string, unknown> = {}
    try { linkData = JSON.parse(rawText) } catch { /* non-JSON response */ }

    console.log('[get-login-link] Supabase status:', linkRes.status, '| keys:', Object.keys(linkData).join(','))

    if (!linkRes.ok) {
      const errMsg = (linkData?.msg ?? linkData?.error_description ?? linkData?.error ?? `Supabase error ${linkRes.status}`) as string
      console.error('[get-login-link] generate_link error:', errMsg)
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    const actionLink = linkData?.action_link as string | undefined
    if (!actionLink) {
      const errMsg = `Link no generado. Respuesta: ${rawText.slice(0, 200)}`
      console.error('[get-login-link]', errMsg)
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    return NextResponse.json({ url: actionLink })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[get-login-link] Unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
