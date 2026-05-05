import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Sin empresa asignada' }, { status: 403 })
  }

  const buyerOrgId = profile.organization_id

  // Verificar que el producto no pertenece a su propia empresa
  const { data: product } = await supabase
    .from('products')
    .select('organization_id')
    .eq('id', productId)
    .single()

  if (product?.organization_id === buyerOrgId) {
    return NextResponse.json({ error: 'No podés consultar tus propios productos' }, { status: 403 })
  }

  // Buscar sesión abierta existente para este par producto+comprador
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id, status')
    .eq('product_id', productId)
    .eq('buyer_org_id', buyerOrgId)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, isNew: false })
  }

  // Crear nueva sesión
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      product_id:        productId,
      buyer_org_id:      buyerOrgId,
      buyer_user_id:     user.id,
      status:            'open',
      last_message_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessionId: session.id, isNew: true })
}
