'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getCachedSets,
  setCachedSets,
  getCachedSet,
  setCachedSet,
  invalidateSetsCache,
  getCachedFlashcards,
  setCachedFlashcards,
  invalidateFlashcardsCache,
  getCachedStories,
  setCachedStories,
  invalidateStoriesCache,
  getCachedTranslation,
  setCachedTranslation,
  type CachedSet,
  type CachedFlashcard,
  type CachedStory,
  type CachedTranslation,
} from '@/lib/cache'

// ============ GENERIC SWR-like HOOK ============

interface UseCacheOptions<T> {
  cacheKey: string
  fetcher: () => Promise<T>
  getCache: () => Promise<T | null>
  setCache: (data: T) => Promise<void>
  revalidateOnMount?: boolean
  revalidateOnFocus?: boolean
  dedupingInterval?: number
}

interface UseCacheResult<T> {
  data: T | null
  isLoading: boolean
  isValidating: boolean
  error: Error | null
  mutate: (data?: T) => Promise<void>
}

function useCache<T>(options: UseCacheOptions<T>): UseCacheResult<T> {
  const {
    fetcher,
    getCache,
    setCache,
    revalidateOnMount = true,
    revalidateOnFocus = true,
    dedupingInterval = 2000,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const lastFetchTime = useRef<number>(0)
  const isMounted = useRef(true)

  const revalidate = useCallback(async () => {
    const now = Date.now()
    if (now - lastFetchTime.current < dedupingInterval) {
      return // Deduping
    }
    lastFetchTime.current = now

    setIsValidating(true)
    try {
      const freshData = await fetcher()
      if (isMounted.current) {
        setData(freshData)
        setError(null)
        await setCache(freshData)
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      }
    } finally {
      if (isMounted.current) {
        setIsValidating(false)
      }
    }
  }, [fetcher, setCache, dedupingInterval])

  // Initial load from cache, then revalidate
  useEffect(() => {
    isMounted.current = true
    let cancelled = false

    const loadData = async () => {
      // 1. Try cache first (instant!)
      const cached = await getCache()
      if (cached && !cancelled) {
        setData(cached)
        setIsLoading(false)
      }

      // 2. Revalidate in background
      if (revalidateOnMount) {
        await revalidate()
      }

      if (!cancelled) {
        setIsLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
      isMounted.current = false
    }
  }, [getCache, revalidate, revalidateOnMount])

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus) return

    const handleFocus = () => {
      revalidate()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [revalidate, revalidateOnFocus])

  const mutate = useCallback(async (newData?: T) => {
    if (newData) {
      setData(newData)
      await setCache(newData)
    } else {
      await revalidate()
    }
  }, [setCache, revalidate])

  return { data, isLoading, isValidating, error, mutate }
}

// ============ SPECIFIC HOOKS ============

// Hook dla zestawów fiszek
export function useSets() {
  return useCache<CachedSet[]>({
    cacheKey: 'sets',
    fetcher: async () => {
      const res = await fetch('/api/sets')
      if (!res.ok) throw new Error('Failed to fetch sets')
      return res.json()
    },
    getCache: getCachedSets,
    setCache: setCachedSets,
  })
}

// Hook dla pojedynczego zestawu z fiszkami
export function useSet(setId: string) {
  const [set, setSet] = useState<CachedSet | null>(null)
  const [flashcards, setFlashcards] = useState<CachedFlashcard[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)

  const fetchData = useCallback(async () => {
    setIsValidating(true)
    try {
      const res = await fetch(`/api/sets/${setId}`)
      if (!res.ok) throw new Error('Failed to fetch set')
      const data = await res.json()

      setSet(data)
      setFlashcards(data.flashcards || [])

      // Cache
      await setCachedSet(data)
      if (data.flashcards) {
        await setCachedFlashcards(
          data.flashcards.map((f: CachedFlashcard) => ({ ...f, setId }))
        )
      }
    } catch (error) {
      console.error('Error fetching set:', error)
    } finally {
      setIsValidating(false)
      setIsLoading(false)
    }
  }, [setId])

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      // 1. Cache first
      const [cachedSet, cachedFlashcards] = await Promise.all([
        getCachedSet(setId),
        getCachedFlashcards(setId),
      ])

      if (cachedSet && !cancelled) {
        setSet(cachedSet)
        setIsLoading(false)
      }
      if (cachedFlashcards && !cancelled) {
        setFlashcards(cachedFlashcards)
      }

      // 2. Revalidate
      if (!cancelled) {
        await fetchData()
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [setId, fetchData])

  const mutate = useCallback(async () => {
    await invalidateFlashcardsCache(setId)
    await fetchData()
  }, [setId, fetchData])

  const addFlashcard = useCallback(async (flashcard: CachedFlashcard) => {
    setFlashcards((prev) => prev ? [...prev, flashcard] : [flashcard])
    // Background sync
    await setCachedFlashcards([flashcard])
  }, [])

  const removeFlashcard = useCallback(async (flashcardId: string) => {
    setFlashcards((prev) => prev ? prev.filter((f) => f.id !== flashcardId) : null)
  }, [])

  return {
    set,
    flashcards,
    isLoading,
    isValidating,
    mutate,
    addFlashcard,
    removeFlashcard,
  }
}

// Hook dla historyjek
export function useStories() {
  return useCache<CachedStory[]>({
    cacheKey: 'stories',
    fetcher: async () => {
      const res = await fetch('/api/stories')
      if (!res.ok) throw new Error('Failed to fetch stories')
      return res.json()
    },
    getCache: getCachedStories,
    setCache: setCachedStories,
  })
}

// Hook dla tłumaczeń z cache (najważniejsze dla szybkości!)
export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false)
  const translationCache = useRef<Map<string, CachedTranslation>>(new Map())

  const translate = useCallback(async (
    word: string,
    language: string,
    context?: string
  ): Promise<CachedTranslation | null> => {
    // 1. Sprawdź memory cache
    const cacheKey = `${word.toLowerCase()}_${language}_${context || ''}`
    if (translationCache.current.has(cacheKey)) {
      return translationCache.current.get(cacheKey)!
    }

    // 2. Sprawdź IndexedDB cache
    const cached = await getCachedTranslation(word, language, context)
    if (cached) {
      translationCache.current.set(cacheKey, cached)
      return cached
    }

    // 3. Fetch from API
    setIsTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language, context }),
      })

      if (!res.ok) throw new Error('Translation failed')
      const data = await res.json()

      const translation: CachedTranslation = {
        word,
        translation: data.translation,
        partOfSpeech: data.partOfSpeech,
        infinitive: data.infinitive,
        infinitiveTranslation: data.infinitiveTranslation,
        language,
        context,
      }

      // Cache it!
      translationCache.current.set(cacheKey, translation)
      await setCachedTranslation(translation)

      return translation
    } catch (error) {
      console.error('Translation error:', error)
      return null
    } finally {
      setIsTranslating(false)
    }
  }, [])

  // Batch translate (dla prefetchingu)
  const translateBatch = useCallback(async (
    words: { word: string; context?: string }[],
    language: string
  ): Promise<Map<string, CachedTranslation>> => {
    const results = new Map<string, CachedTranslation>()
    const toFetch: { word: string; context?: string }[] = []

    // Check cache first
    for (const { word, context } of words) {
      const cached = await getCachedTranslation(word, language, context)
      if (cached) {
        results.set(word, cached)
      } else {
        toFetch.push({ word, context })
      }
    }

    // Fetch uncached in parallel (max 5 at a time)
    const batchSize = 5
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize)
      const translations = await Promise.all(
        batch.map(({ word, context }) => translate(word, language, context))
      )
      translations.forEach((t, idx) => {
        if (t) results.set(batch[idx].word, t)
      })
    }

    return results
  }, [translate])

  return { translate, translateBatch, isTranslating }
}

// Prefetch hook - ładuje dane w tle
export function usePrefetch() {
  const prefetchSets = useCallback(async () => {
    const cached = await getCachedSets()
    if (!cached || cached.length === 0) {
      try {
        const res = await fetch('/api/sets')
        if (res.ok) {
          const sets = await res.json()
          await setCachedSets(sets)
        }
      } catch {
        // Silent fail
      }
    }
  }, [])

  const prefetchStories = useCallback(async () => {
    const cached = await getCachedStories()
    if (!cached || cached.length === 0) {
      try {
        const res = await fetch('/api/stories')
        if (res.ok) {
          const stories = await res.json()
          await setCachedStories(stories)
        }
      } catch {
        // Silent fail
      }
    }
  }, [])

  const prefetchAll = useCallback(async () => {
    await Promise.all([prefetchSets(), prefetchStories()])
  }, [prefetchSets, prefetchStories])

  return { prefetchSets, prefetchStories, prefetchAll }
}

// Hook do invalidacji cache (po mutacjach)
export function useCacheInvalidation() {
  const invalidateSets = useCallback(async () => {
    await invalidateSetsCache()
  }, [])

  const invalidateFlashcards = useCallback(async (setId?: string) => {
    await invalidateFlashcardsCache(setId)
  }, [])

  const invalidateStories = useCallback(async () => {
    await invalidateStoriesCache()
  }, [])

  return { invalidateSets, invalidateFlashcards, invalidateStories }
}
