import Navbar from '@/components/layout/Navbar'
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1">{children}</main></div>
}
