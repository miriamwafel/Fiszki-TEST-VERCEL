'use client'

import { useEffect, useCallback, useRef } from 'react'

// Event name for notes synchronization
const NOTES_UPDATED_EVENT = 'notes-updated'

export interface NotesUpdatedDetail {
  action: 'created' | 'updated' | 'deleted'
  noteId?: string
  timestamp: number
}

/**
 * Emit a notes updated event to notify other components
 * This works within the same browser tab/window
 */
export function emitNotesUpdated(detail: Omit<NotesUpdatedDetail, 'timestamp'>) {
  const event = new CustomEvent(NOTES_UPDATED_EVENT, {
    detail: {
      ...detail,
      timestamp: Date.now(),
    },
  })
  window.dispatchEvent(event)
}

/**
 * Hook to listen for notes updates and auto-refresh when tab becomes visible
 *
 * This solves synchronization issues:
 * 1. When notes are added via Widget, the /notes page gets notified
 * 2. When user switches between mobile/desktop or tabs, data refreshes automatically
 * 3. Works across components in the same browser session
 */
export function useNotesSync(onRefresh: () => void | Promise<void>) {
  const lastRefreshRef = useRef<number>(Date.now())
  const isRefreshingRef = useRef<boolean>(false)

  // Debounced refresh to prevent multiple rapid refreshes
  const debouncedRefresh = useCallback(async () => {
    const now = Date.now()
    // Minimum 1 second between refreshes
    if (now - lastRefreshRef.current < 1000 || isRefreshingRef.current) {
      return
    }

    isRefreshingRef.current = true
    lastRefreshRef.current = now

    try {
      await onRefresh()
    } finally {
      isRefreshingRef.current = false
    }
  }, [onRefresh])

  useEffect(() => {
    // Listen for custom events from other components (same tab)
    const handleNotesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<NotesUpdatedDetail>
      console.log('[NotesSync] Notes updated event received:', customEvent.detail)
      debouncedRefresh()
    }

    // Refresh when tab becomes visible again (handles switching between tabs/devices)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current
        // Refresh if more than 5 seconds since last refresh
        if (timeSinceLastRefresh > 5000) {
          console.log('[NotesSync] Tab became visible, refreshing notes...')
          debouncedRefresh()
        }
      }
    }

    // Refresh when window gains focus (helps with desktop/mobile sync)
    const handleFocus = () => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current
      // Refresh if more than 10 seconds since last refresh
      if (timeSinceLastRefresh > 10000) {
        console.log('[NotesSync] Window focused, refreshing notes...')
        debouncedRefresh()
      }
    }

    window.addEventListener(NOTES_UPDATED_EVENT, handleNotesUpdated)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener(NOTES_UPDATED_EVENT, handleNotesUpdated)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [debouncedRefresh])

  // Return function to manually trigger refresh
  return { triggerRefresh: debouncedRefresh }
}

/**
 * Hook specifically for components that only need to emit events
 * (like StickyNotesWidget)
 */
export function useNotesEmitter() {
  return {
    emitCreated: (noteId?: string) => emitNotesUpdated({ action: 'created', noteId }),
    emitUpdated: (noteId: string) => emitNotesUpdated({ action: 'updated', noteId }),
    emitDeleted: (noteId: string) => emitNotesUpdated({ action: 'deleted', noteId }),
  }
}
