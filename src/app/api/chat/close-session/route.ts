import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, getAdminEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { sessionId, reason, salePrice } = await req.json() as {
    sessionId: string
    reason: 'no_deal' | 'agreed'
    salePrice?: number
  }

  if (!sessionId || !reason) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  if (reason === 'agreed' && !salePrice) return NextResponse.json({ error: 'Precio requerido para cerrar con acuerdo' }, { status: 400 })

  const status = reason === 'agreed' ? 'closed_agreed' : 'closed_no_deal'

  // Obtener la sesión con info del producto
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, product_id, buyer_org_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  if (session.status !== 'open') return NextResponse.json({ error: 'La sesión ya está cerrada' }, { status: 400 })

  // Cerrar la sesión
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      status,
      sale_price: reason === 'agreed' ? salePrice : null,
      closed_at:  new Date().toISOString(),
      closed_by:  user.id,
    })
    .eq('id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Obtener datos para los emails
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origin      = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  if (serviceKey && supabaseUrl) {
    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [{ data: product }, { data: buyerOrg }] = await Promise.all([
      admin.from('products').select('sku, description, organizations(name, contact_email)').eq('id', session.product_id).single(),
      admin.from('organizations').select('name, contact_email').eq('id', session.buyer_org_id).single(),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sellerOrg = (product as any)?.organizations
    const productSku  = (product as { sku?: string })?.sku ?? ''
    const productDesc = (product as { description?: string })?.description ?? ''
    const sellerEmail = sellerOrg?.contact_email
    const buyerEmail  = (buyerOrg as { contact_email?: string })?.contact_email
    const sellerName  = sellerOrg?.name ?? 'Vendedor'
    const buyerName   = (buyerOrg as { name?: string })?.name ?? 'Comprador'
    const adminEmail  = getAdminEmail()

    const subject = reason === 'agreed'
      ? `Chat cerrado con acuerdo — ${productSku}`
      : `Chat finalizado sin acuerdo — ${productSku}`

    const bodyHtml = reason === 'agreed'
      ? `<p>El chat sobre <strong>${productSku}: ${productDesc}</strong> fue cerrado con un acuerdo.<br/>
         Precio declarado: <strong>$${salePrice?.toLocaleString('es-AR')}</strong></p>
         <p>Comprador: <strong>${buyerName}</strong> | Vendedor: <strong>${sellerName}</strong></p>
         <a href="${origin}/mis-chats">Ver en Declavo →</a>`
      : `<p>El chat sobre <strong>${productSku}: ${productDesc}</strong> fue cerrado sin acuerdo.</p>
         <p>Comprador: <strong>${buyerName}</strong> | Vendedor: <strong>${sellerName}</strong></p>`

    const emailHtml = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1020;color:#e0e0f0;border-radius:16px;">${bodyHtml}</div>`

    await Promise.all([
      sellerEmail ? sendEmail({ to: sellerEmail, subject, html: emailHtml }) : Promise.resolve(),
      buyerEmail  ? sendEmail({ to: buyerEmail,  subject, html: emailHtml }) : Promise.resolve(),
      adminEmail  ? sendEmail({ to: adminEmail,  subject, html: emailHtml }) : Promise.resolve(),
    ])
  }

  return NextResponse.json({ ok: true })
}
