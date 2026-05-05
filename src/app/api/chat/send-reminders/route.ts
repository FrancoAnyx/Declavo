import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, getAdminEmail } from '@/lib/email'

// Invocado por el cron de Vercel cada 6 horas
// Busca sesiones abiertas sin respuesta hace más de 12 horas y envía recordatorio
export async function GET(req: NextRequest) {
  // Verificar cron secret para evitar llamadas no autorizadas
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origin      = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Sin configuración' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  // Sesiones abiertas con último mensaje hace más de 12 horas y sin recordatorio enviado
  const { data: sessions } = await admin
    .from('chat_sessions')
    .select('id, product_id, buyer_org_id, last_message_from')
    .eq('status', 'open')
    .lt('last_message_at', cutoff)
    .is('reminder_sent_at', null)
    .limit(50)

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  let sent = 0

  for (const session of sessions as {
    id: string; product_id: string; buyer_org_id: string; last_message_from: string | null
  }[]) {
    const [{ data: product }, { data: buyerOrg }] = await Promise.all([
      admin.from('products').select('sku, description, organizations(name, contact_email)').eq('id', session.product_id).single(),
      admin.from('organizations').select('name, contact_email').eq('id', session.buyer_org_id).single(),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sellerOrg   = (product as any)?.organizations
    const productSku  = (product as { sku?: string })?.sku ?? ''
    const productDesc = (product as { description?: string })?.description ?? ''
    const sellerEmail = sellerOrg?.contact_email
    const buyerEmail  = (buyerOrg as { contact_email?: string })?.contact_email
    const sellerName  = sellerOrg?.name ?? 'Vendedor'
    const buyerName   = (buyerOrg as { name?: string })?.name ?? 'Comprador'

    // Si el último que habló fue el comprador → recordatorio al vendedor (y viceversa)
    const lastFrom = session.last_message_from
    const reminderTo   = lastFrom === 'buyer' ? sellerEmail : buyerEmail
    const reminderName = lastFrom === 'buyer' ? sellerName  : buyerName
    const link = lastFrom === 'buyer' ? `${origin}/mis-chats` : `${origin}/catalogo`

    if (reminderTo) {
      const html = `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:28px 22px;background:#0f1020;color:#e0e0f0;border-radius:16px;">
          <div style="margin-bottom:20px;">
            <span style="width:9px;height:9px;border-radius:50%;background:#7c6ff7;display:inline-block;margin-right:8px;"></span>
            <span style="font-size:18px;font-weight:800;">Declavo</span>
          </div>
          <h2 style="font-size:16px;margin:0 0 10px;">Tenés una consulta sin responder</h2>
          <p style="font-size:13px;color:#9898b8;margin:0 0 18px;line-height:1.6;">
            Hola <strong style="color:#e0e0f0;">${reminderName}</strong>, hay una consulta de chat sobre
            <strong style="color:#7c6ff7;">${productSku}: ${productDesc}</strong> que lleva más de 12 horas
            sin respuesta. Te pedimos que la revises a la brevedad.
          </p>
          <a href="${link}" style="display:inline-block;padding:11px 22px;background:#7c6ff7;color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">
            Responder ahora →
          </a>
        </div>
      `
      await sendEmail({
        to:      reminderTo,
        subject: `Recordatorio: consulta sin respuesta — ${productSku}`,
        html,
      })
      sent++
    }

    // Admin también recibe el recordatorio
    const adminEmail = getAdminEmail()
    if (adminEmail) {
      await sendEmail({
        to:      adminEmail,
        subject: `[Admin] Recordatorio 12hs — ${productSku}`,
        html: `<p>La sesión ${session.id} lleva más de 12hs sin respuesta (último mensaje de: ${lastFrom ?? 'desconocido'}).</p><p>Producto: ${productSku} — ${productDesc}</p>`,
      })
    }

    // Marcar recordatorio como enviado
    await admin.from('chat_sessions').update({
      reminder_sent_at: new Date().toISOString(),
    }).eq('id', session.id)
  }

  return NextResponse.json({ ok: true, sent })
}
