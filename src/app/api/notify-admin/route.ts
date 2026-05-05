import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getAdminEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { name, email, company, requestId } = await req.json() as {
    name: string
    email: string
    company?: string
    requestId: string
  }

  const adminEmail = getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: 'ADMIN_EMAIL no configurado' })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`

  await sendEmail({
    to:      adminEmail,
    subject: `Nueva solicitud de acceso: ${name}${company ? ` (${company})` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0f1020;color:#e0e0f0;border-radius:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <span style="width:10px;height:10px;border-radius:50%;background:#7c6ff7;display:inline-block;box-shadow:0 0 12px #7c6ff7;"></span>
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">Declavo</span>
        </div>
        <h1 style="font-size:18px;font-weight:700;margin:0 0 8px;">Nueva solicitud de acceso pendiente</h1>
        <p style="font-size:14px;color:#9898b8;line-height:1.6;margin:0 0 20px;">
          Alguien solicitó acceso a la plataforma. Tenés que revisarlo desde el panel de administración.
        </p>
        <div style="background:#1a1c30;border:1px solid #2a2c45;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;"><span style="color:#7c6ff7;font-weight:700;">Nombre:</span> <span style="color:#e0e0f0;">${name}</span></p>
          <p style="margin:0 0 8px;font-size:13px;"><span style="color:#7c6ff7;font-weight:700;">Email:</span> <span style="color:#e0e0f0;">${email}</span></p>
          ${company ? `<p style="margin:0;font-size:13px;"><span style="color:#7c6ff7;font-weight:700;">Empresa:</span> <span style="color:#e0e0f0;">${company}</span></p>` : ''}
        </div>
        <a href="${origin}/admin?s=solicitudes" style="display:inline-block;padding:12px 28px;background:#7c6ff7;color:#fff;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;">
          Ver solicitudes pendientes →
        </a>
        <p style="font-size:11px;color:#3a3a5a;margin-top:24px;">ID de solicitud: ${requestId}</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
