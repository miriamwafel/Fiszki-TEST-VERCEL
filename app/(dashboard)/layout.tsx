import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'
import { PrefetchProvider } from '@/components/PrefetchProvider'
import { StickyNotesWidget } from '@/components/StickyNotesWidget'
import { AIChatWidget } from '@/components/AIChatWidget'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <PrefetchProvider>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </PrefetchProvider>
      <StickyNotesWidget />
      <AIChatWidget />
    </div>
  )
}
