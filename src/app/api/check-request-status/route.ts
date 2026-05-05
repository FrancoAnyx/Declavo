import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  }

  const supabase = createClient()

  const { data } = await supabase
    .from('access_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!data) return NextResponse.json({ status: 'not_found' })
  return NextResponse.json({ status: data.status })
}
