import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: request } = await admin
    .from('access_requests')
    .select('email, status')
    .eq('id', id)
    .single()

  if (!request || request.status !== 'approved') {
    return NextResponse.json({ error: 'Solicitud no aprobada' }, { status: 403 })
  }

  const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: request.email,
    options: { redirectTo: `${origin}/catalogo` },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url: data.properties.action_link })
}
