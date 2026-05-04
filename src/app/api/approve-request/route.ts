import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { requestId, email, name, orgId, role } = await req.json() as {
    requestId: string
    email: string
    name: string
    orgId: string
    role: 'member' | 'org_admin'
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) return NextResponse.json({ error: 'Falta NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 })
  if (!serviceKey) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo: `${origin}/catalogo`,
  })

  if (inviteError) {
    return NextResponse.json({ error: `No se pudo crear el usuario: ${inviteError.message}` }, { status: 500 })
  }

  const userId = inviteData.user.id

  await admin.from('profiles').upsert({
    id: userId,
    full_name: name,
    role,
    organization_id: orgId,
  }, { onConflict: 'id' })

  await supabase.from('access_requests').update({
    status: 'approved',
    processed_at: new Date().toISOString(),
    processed_by: user.id,
  }).eq('id', requestId)

  return NextResponse.json({ ok: true })
}
