import Navbar from '@/components/layout/Navbar'
import AuthHashHandler from '@/components/AuthHashHandler'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AuthHashHandler />
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
