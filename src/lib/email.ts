const BREVO_API_KEY = process.env.BREVO_API_KEY
const FROM_EMAIL   = process.env.FROM_EMAIL ?? 'noreply@declavo.com.ar'
const FROM_NAME    = 'Declavo'
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? ''

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!BREVO_API_KEY) {
    console.warn('[email] BREVO_API_KEY no configurado — email no enviado')
    return { ok: false, error: 'BREVO_API_KEY no configurado' }
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { message?: string }).message ?? `Brevo error ${res.status}`
    console.error('[email] Error:', msg)
    return { ok: false, error: msg }
  }

  return { ok: true }
}

export function getAdminEmail() {
  return ADMIN_EMAIL
}
