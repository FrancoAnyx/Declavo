import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { productId } = await req.json() as { productId: string }
  if (!productId) return NextResponse.json({ error: 'productId requerido' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  // Validar que el usuario es vendedor del producto o super_admin
  if (profile?.role !== 'super_admin') {
    const { data: product } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', productId)
      .single()

    if (!product || product.organization_id !== profile?.organization_id) {
      return NextResponse.json({ error: 'Sin permisos para eliminar esta conversación' }, { status: 403 })
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
  }

  const admin = createAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await admin.from('product_messages').delete().eq('product_id', productId)
  await admin.from('chat_sessions').delete().eq('product_id', productId)

  return NextResponse.json({ ok: true })
}
