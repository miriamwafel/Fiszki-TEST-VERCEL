'use client'

import { useEffect } from 'react'
import { usePrefetch } from '@/lib/hooks/useCache'

/**
 * PrefetchProvider - ładuje dane w tle przy starcie aplikacji
 * Dzięki temu dane są już w cache gdy user przejdzie do strony
 */
export function PrefetchProvider({ children }: { children: React.ReactNode }) {
  const { prefetchAll } = usePrefetch()

  useEffect(() => {
    // Prefetch po załadowaniu strony (nie blokuje renderingu)
    const timer = setTimeout(() => {
      prefetchAll()
    }, 100)

    return () => clearTimeout(timer)
  }, [prefetchAll])

  return <>{children}</>
}
