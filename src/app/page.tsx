import { redirect } from 'next/navigation'

// La raíz siempre redirige al catálogo (público para todos)
export default function Home() {
  redirect('/catalogo')
}
