/**
 * Hook do synchronizacji stanu powtórek między komponentami.
 *
 * Problem: ReviewScheduleManager (w zestawie) i ReviewCalendar (na dashboard)
 * to osobne komponenty bez wspólnego stanu. Gdy użytkownik oznaczy powtórkę
 * jako completed w zestawie i wróci na dashboard - kalendarz nie wie o zmianie.
 *
 * Rozwiązanie: Custom event bus przez window events.
 */

const REVIEWS_UPDATED_EVENT = 'reviews-updated'

export interface ReviewsUpdatedDetail {
  type: 'completed' | 'created' | 'deleted' | 'updated'
  reviewId?: string
  setId?: string
  timestamp: number
}

/**
 * Emituje event że powtórki zostały zmienione.
 * Wywołuj po każdej akcji w ReviewScheduleManager.
 */
export function emitReviewsUpdated(detail: Omit<ReviewsUpdatedDetail, 'timestamp'>) {
  const event = new CustomEvent<ReviewsUpdatedDetail>(REVIEWS_UPDATED_EVENT, {
    detail: {
      ...detail,
      timestamp: Date.now(),
    },
  })
  window.dispatchEvent(event)

  // Zapisz timestamp w sessionStorage żeby komponenty mogły sprawdzić po mount
  sessionStorage.setItem('reviews-last-updated', Date.now().toString())
}

/**
 * Hook do nasłuchiwania na zmiany w powtórkach.
 * Wywołaj callback gdy dane się zmienią.
 */
export function useReviewsListener(callback: () => void) {
  if (typeof window === 'undefined') return

  const handler = () => {
    callback()
  }

  window.addEventListener(REVIEWS_UPDATED_EVENT, handler)

  return () => {
    window.removeEventListener(REVIEWS_UPDATED_EVENT, handler)
  }
}

/**
 * Sprawdza czy dane mogły się zmienić od ostatniego fetch.
 * Użyj na mount komponentu.
 */
export function shouldRefetchReviews(lastFetchTime: number): boolean {
  if (typeof window === 'undefined') return false

  const lastUpdated = sessionStorage.getItem('reviews-last-updated')
  if (!lastUpdated) return false

  return parseInt(lastUpdated, 10) > lastFetchTime
}
