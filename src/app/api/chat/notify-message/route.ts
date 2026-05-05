import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, getAdminEmail } from '@/lib/email'

// Llamado por el frontend tras cada mensaje exitoso
export async function POST(req: NextRequest) {
  const { sessionId, messageBody, senderRole } = await req.json() as {
    sessionId: string
    messageBody: string
    senderRole: 'buyer' | 'seller'
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origin      = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, error: 'Sin configuración de Supabase' })
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Actualizar last_message_at y last_message_from en la sesión
  await admin.from('chat_sessions').update({
    last_message_at:   new Date().toISOString(),
    last_message_from: senderRole,
    reminder_sent_at:  null, // reset para el cron de 12hs
  }).eq('id', sessionId)

  // Obtener datos de la sesión y producto para el email
  const { data: session } = await admin
    .from('chat_sessions')
    .select('product_id, buyer_org_id')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ ok: false })

  const [{ data: product }, { data: buyerOrg }] = await Promise.all([
    admin.from('products').select('sku, description, organizations(name, contact_email)').eq('id', session.product_id).single(),
    admin.from('organizations').select('name, contact_email').eq('id', session.buyer_org_id).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sellerOrg   = (product as any)?.organizations
  const productSku  = (product as { sku?: string })?.sku ?? ''
  const productDesc = (product as { description?: string })?.description ?? ''
  const sellerEmail = sellerOrg?.contact_email
  const sellerName  = sellerOrg?.name ?? 'Vendedor'
  const buyerEmail  = (buyerOrg as { contact_email?: string })?.contact_email
  const buyerName   = (buyerOrg as { name?: string })?.name ?? 'Comprador'
  const adminEmail  = getAdminEmail()

  const isBuyer     = senderRole === 'buyer'
  const recipientName  = isBuyer ? sellerName  : buyerName
  const recipientEmail = isBuyer ? sellerEmail : buyerEmail
  const senderName     = isBuyer ? buyerName   : sellerName
  const chatLink       = isBuyer
    ? `${origin}/mis-chats`
    : `${origin}/catalogo`

  const subject = `Nueva consulta de chat — ${productSku}`
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0f1020;color:#e0e0f0;border-radius:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <span style="width:10px;height:10px;border-radius:50%;background:#7c6ff7;display:inline-block;"></span>
        <span style="font-size:20px;font-weight:800;">Declavo</span>
      </div>
      <h2 style="font-size:16px;margin:0 0 8px;">Tenés una nueva consulta de chat</h2>
      <p style="font-size:13px;color:#9898b8;margin:0 0 16px;">
        <strong style="color:#e0e0f0;">${senderName}</strong> envió un mensaje sobre
        <strong style="color:#e0e0f0;">${productSku}: ${productDesc}</strong>
      </p>
      <div style="background:#1a1c30;border:1px solid #2a2c45;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#e0e0f0;">"${messageBody}"</p>
      </div>
      <p style="font-size:12px;color:#7898b8;margin:0 0 20px;">
        Este mensaje fue enviado a través de la plataforma Declavo. ${recipientName}, revisalo y respondé a la brevedad.
      </p>
      <a href="${chatLink}" style="display:inline-block;padding:11px 24px;background:#7c6ff7;color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
        Ver en Declavo →
      </a>
    </div>
  `

  const adminHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0f1020;color:#e0e0f0;border-radius:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <span style="width:10px;height:10px;border-radius:50%;background:#7c6ff7;display:inline-block;"></span>
        <span style="font-size:20px;font-weight:800;">Declavo — Admin</span>
      </div>
      <h2 style="font-size:16px;margin:0 0 8px;">Actividad de chat</h2>
      <div style="background:#1a1c30;border:1px solid #2a2c45;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:12px;color:#7898b8;">
          <strong style="color:#7c6ff7;">${senderName}</strong> (${senderRole === 'buyer' ? 'comprador' : 'vendedor'}) →
          <strong style="color:#7c6ff7;">${productSku}</strong>
        </p>
        <p style="margin:0;font-size:14px;color:#e0e0f0;">"${messageBody}"</p>
      </div>
      <a href="${origin}/admin?s=chats" style="display:inline-block;padding:10px 20px;background:#7c6ff7;color:#fff;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">
        Ver todos los chats →
      </a>
    </div>
  `

  await Promise.all([
    recipientEmail ? sendEmail({ to: recipientEmail, subject, html }) : Promise.resolve(),
    adminEmail     ? sendEmail({ to: adminEmail, subject: `[Admin] ${subject}`, html: adminHtml }) : Promise.resolve(),
  ])

  return NextResponse.json({ ok: true })
}
