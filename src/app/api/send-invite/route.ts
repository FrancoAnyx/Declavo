import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { to, name, link, expires_days } = await req.json() as {
    to: string; name: string; link: string; expires_days: number
  }

  const apiKey  = process.env.RESEND_API_KEY
  const from    = process.env.SEND_FROM_EMAIL ?? 'Declavo <noreply@declavo.com>'

  if (!apiKey) return NextResponse.json({ error: 'Servicio de email no configurado' }, { status: 500 })

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f11;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #27272a;">
            <span style="display:inline-flex;align-items:center;gap:8px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>
              <span style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;color:#f4f4f5;letter-spacing:-0.5px;">Declavo</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f4f5;">
              ¡Hola, ${name.split(' ')[0]}!
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.6;">
              Tu solicitud de acceso a <strong style="color:#f4f4f5;">Declavo</strong> fue aprobada.
              Hacé clic en el botón para activar tu cuenta y acceder al catálogo completo.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#6366f1;border-radius:10px;">
                  <a href="${link}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">
                    Activar mi cuenta →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:13px;color:#71717a;">
              O copiá este enlace en tu navegador:
            </p>
            <p style="margin:0;font-size:12px;color:#6366f1;word-break:break-all;">
              ${link}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #27272a;">
            <p style="margin:0;font-size:12px;color:#52525b;line-height:1.5;">
              Este link vence en <strong style="color:#71717a;">${expires_days} día${expires_days !== 1 ? 's' : ''}</strong>.
              Si no solicitaste acceso, podés ignorar este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject: 'Tu acceso a Declavo está listo', html }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
