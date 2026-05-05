const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL    = process.env.FROM_EMAIL ?? 'Declavo <noreply@declavo.com>'
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL ?? ''

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado — email no enviado')
    return { ok: false, error: 'RESEND_API_KEY no configurado' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { message?: string }).message ?? `Resend error ${res.status}`
    console.error('[email] Error:', msg)
    return { ok: false, error: msg }
  }

  return { ok: true }
}

export function getAdminEmail() {
  return ADMIN_EMAIL
}
