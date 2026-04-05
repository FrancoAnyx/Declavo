import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  // El catálogo es público — redirigir siempre ahí
  // Si el usuario ya tiene sesión, igual llega al catálogo
  const supabase = createClient()
  await supabase.auth.getUser() // refresca la sesión si existe
  redirect('/catalogo')
}
