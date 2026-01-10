/**
 * System synchronizacji powtórek między komponentami.
 *
 * Używa:
 * - Custom events dla komunikacji w tej samej karcie
 * - sessionStorage dla synchronizacji po nawigacji
 */

import { useEffect, useCallback } from 'react'

const REVIEWS_UPDATED_EVENT = 'reviews-updated'
const STORAGE_KEY = 'reviews-last-updated'

export interface ReviewsUpdatedDetail {
  type: 'completed' | 'created' | 'deleted' | 'updated'
  reviewId?: string
  setId?: string
  timestamp: number
}

/**
 * Emituje event że powtórki zostały zmienione.
 * Wywołuj po KAŻDEJ udanej operacji na powtórkach.
 */
export function emitReviewsUpdated(detail: Omit<ReviewsUpdatedDetail, 'timestamp'>) {
  if (typeof window === 'undefined') return

  const timestamp = Date.now()

  // Custom event dla tej samej karty
  const event = new CustomEvent<ReviewsUpdatedDetail>(REVIEWS_UPDATED_EVENT, {
    detail: { ...detail, timestamp },
  })
  window.dispatchEvent(event)

  // sessionStorage dla nawigacji
  try {
    sessionStorage.setItem(STORAGE_KEY, timestamp.toString())
  } catch {
    // Ignoruj błędy sessionStorage
  }
}

/**
 * Hook do nasłuchiwania zmian w powtórkach.
 * Wywołuje callback gdy inne komponenty zmienią powtórki.
 */
export function useReviewsListener(callback: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = () => {
      callback()
    }

    window.addEventListener(REVIEWS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, handler)
  }, [callback])
}

/**
 * Sprawdza czy dane mogły się zmienić od ostatniego fetch.
 */
export function shouldRefetchReviews(lastFetchTime: number): boolean {
  if (typeof window === 'undefined') return false

  try {
    const lastUpdated = sessionStorage.getItem(STORAGE_KEY)
    if (!lastUpdated) return false
    return parseInt(lastUpdated, 10) > lastFetchTime
  } catch {
    return false
  }
}

/**
 * Hook który automatycznie odświeża dane po zmianach.
 * Łączy event listener + sprawdzanie sessionStorage.
 */
export function useReviewsAutoRefresh(
  fetchFn: () => Promise<void>,
  lastFetchTimeRef: React.MutableRefObject<number>
) {
  // Nasłuchuj na eventy z innych komponentów
  const handleUpdate = useCallback(() => {
    fetchFn()
  }, [fetchFn])

  useReviewsListener(handleUpdate)

  // Sprawdź przy focus/visibility czy coś się zmieniło
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAndRefetch = () => {
      if (shouldRefetchReviews(lastFetchTimeRef.current)) {
        fetchFn()
      }
    }

    // Focus i visibility dla nawigacji
    window.addEventListener('focus', checkAndRefetch)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndRefetch()
      }
    })

    return () => {
      window.removeEventListener('focus', checkAndRefetch)
    }
  }, [fetchFn, lastFetchTimeRef])
}
