/**
 * System synchronizacji słownictwa między komponentami.
 *
 * Używa:
 * - Custom events dla komunikacji w tej samej karcie
 * - sessionStorage dla synchronizacji po nawigacji
 */

import { useEffect, useCallback } from 'react'

const VOCABULARY_UPDATED_EVENT = 'vocabulary-updated'
const STORAGE_KEY = 'vocabulary-last-updated'

export interface VocabularyUpdatedDetail {
  type: 'status_changed' | 'word_added' | 'word_removed'
  vocabularyId?: string
  language?: string
  newStatus?: 'unknown' | 'learning' | 'known'
  timestamp: number
}

/**
 * Emituje event że słownictwo zostało zmienione.
 * Wywołuj po KAŻDEJ udanej operacji na słownictwie.
 */
export function emitVocabularyUpdated(detail: Omit<VocabularyUpdatedDetail, 'timestamp'>) {
  if (typeof window === 'undefined') return

  const timestamp = Date.now()

  // Custom event dla tej samej karty
  const event = new CustomEvent<VocabularyUpdatedDetail>(VOCABULARY_UPDATED_EVENT, {
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
 * Hook do nasłuchiwania zmian w słownictwie.
 * Wywołuje callback gdy inne komponenty zmienią słownictwo.
 */
export function useVocabularyListener(callback: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = () => {
      callback()
    }

    window.addEventListener(VOCABULARY_UPDATED_EVENT, handler)
    return () => window.removeEventListener(VOCABULARY_UPDATED_EVENT, handler)
  }, [callback])
}

/**
 * Sprawdza czy dane mogły się zmienić od ostatniego fetch.
 */
export function shouldRefetchVocabulary(lastFetchTime: number): boolean {
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
export function useVocabularyAutoRefresh(
  fetchFn: () => Promise<void>,
  lastFetchTimeRef: React.MutableRefObject<number>
) {
  // Nasłuchuj na eventy z innych komponentów
  const handleUpdate = useCallback(() => {
    fetchFn()
  }, [fetchFn])

  useVocabularyListener(handleUpdate)

  // Sprawdź przy focus/visibility czy coś się zmieniło
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAndRefetch = () => {
      if (shouldRefetchVocabulary(lastFetchTimeRef.current)) {
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
