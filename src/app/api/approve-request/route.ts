import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
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

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) return NextResponse.json({ error: 'Falta NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 })
  if (!serviceKey)  return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Buscar/crear usuario — robusto ante duplicados
  let userId: string | undefined

  // Intentar crear primero
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  userId = userData?.user?.id

  // Si la creación falló o no devolvió ID, buscar usuario existente por email
  if (!userId) {
    console.warn('[approve-request] createUser failed or returned no user:', createError?.message)
    // Buscar en todos los usuarios por email (búsqueda exacta case-insensitive)
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = listData?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
    )
    if (existing) {
      userId = existing.id
      console.log('[approve-request] Found existing user:', userId)
    }
  }

  if (!userId) {
    const errMsg = createError?.message ?? 'No se pudo crear ni encontrar el usuario'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  // 2. Crear/actualizar perfil
  await admin.from('profiles').upsert({
    id: userId,
    full_name: name,
    role,
    organization_id: orgId,
  }, { onConflict: 'id' })

  // 3. Marcar la solicitud como aprobada
  await supabase.from('access_requests').update({
    status:       'approved',
    processed_at: new Date().toISOString(),
    processed_by: user.id,
  }).eq('id', requestId)

  // 4. Generar magic link para que el usuario pueda ingresar
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${serviceKey}`,
      apikey:          serviceKey,
    },
    body: JSON.stringify({
      type:        'invite',
      email,
      redirect_to: `${origin}/auth/callback?next=/set-password`,
    }),
  })

  const linkData = await linkRes.json().catch(() => ({}))
  const actionLink: string | undefined = linkData?.action_link

  // 5. Enviar email al usuario con el link de acceso
  if (actionLink) {
    await sendEmail({
      to:      email,
      subject: '¡Tu acceso a Declavo fue aprobado!',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0f1020;color:#e0e0f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
            <span style="width:10px;height:10px;border-radius:50%;background:#7c6ff7;display:inline-block;box-shadow:0 0 12px #7c6ff7;"></span>
            <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">Declavo</span>
          </div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 10px;">¡Hola, ${name}! Tu acceso fue aprobado</h1>
          <p style="font-size:14px;color:#9898b8;line-height:1.6;margin:0 0 24px;">
            Tu solicitud de acceso a la plataforma Declavo fue revisada y aprobada.<br/>
            Hacé clic en el botón de abajo para crear tu contraseña e ingresar.
          </p>
          <a href="${actionLink}" style="display:inline-block;padding:12px 28px;background:#7c6ff7;color:#fff;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;">
            Crear contraseña e ingresar →
          </a>
          <p style="font-size:12px;color:#5a5a7a;margin-top:28px;line-height:1.5;">
            Si el botón no funciona, copiá y pegá este link en tu navegador:<br/>
            <span style="color:#9898b8;word-break:break-all;">${actionLink}</span>
          </p>
          <p style="font-size:11px;color:#3a3a5a;margin-top:20px;">
            Este link es de un solo uso y expira en 24 horas.
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true, emailSent: !!actionLink, linkGenerated: !!actionLink })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[approve-request] Unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
