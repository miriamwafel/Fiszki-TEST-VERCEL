import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Navbar } from '@/components/Navbar'

function NavbarSkeleton() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="hidden sm:flex sm:ml-8 sm:space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </nav>
  )
}

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

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
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar />
      </Suspense>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </main>
    </div>
  )
}
