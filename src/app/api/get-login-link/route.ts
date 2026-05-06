import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
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

  const origin = req.headers.get('origin')
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? `https://${req.headers.get('host')}`

  // Call Supabase REST API directly — more reliable than SDK wrapper for admin.generateLink
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

  const linkData = await linkRes.json().catch(() => ({}))

  if (!linkRes.ok) {
    return NextResponse.json({ error: linkData?.msg ?? linkData?.error ?? `Supabase error ${linkRes.status}` }, { status: 500 })
  }

  const actionLink: string | undefined = linkData?.action_link
  if (!actionLink) {
    return NextResponse.json({ error: `Link no generado. Keys: ${Object.keys(linkData).join(',')}` }, { status: 500 })
  }

  return NextResponse.json({ url: actionLink })
}
