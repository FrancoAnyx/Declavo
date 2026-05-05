import Navbar from '@/components/layout/Navbar'
export default function MisChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1" style={{ paddingTop: 64 }}>{children}</main>
    </div>
  )
}
