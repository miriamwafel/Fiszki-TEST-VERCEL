/**
 * IndexedDB Cache System dla Fiszki PWA
 *
 * Obsługuje:
 * - Fiszki i zestawy
 * - Historyjki
 * - Tłumaczenia (żeby nie pytać AI o to samo słowo 2x)
 */

const DB_NAME = 'fiszki-cache'
const DB_VERSION = 1

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

// Store names
const STORES = {
  SETS: 'sets',
  FLASHCARDS: 'flashcards',
  STORIES: 'stories',
  TRANSLATIONS: 'translations',
  METADATA: 'metadata',
} as const

// Cache TTL (Time To Live) w ms
const CACHE_TTL = {
  SETS: 5 * 60 * 1000,          // 5 minut
  FLASHCARDS: 5 * 60 * 1000,    // 5 minut
  STORIES: 10 * 60 * 1000,      // 10 minut
  TRANSLATIONS: 24 * 60 * 60 * 1000, // 24 godziny (tłumaczenia się nie zmieniają!)
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Zestawy fiszek
      if (!db.objectStoreNames.contains(STORES.SETS)) {
        db.createObjectStore(STORES.SETS, { keyPath: 'id' })
      }

      // Pojedyncze fiszki
      if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
        const store = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' })
        store.createIndex('setId', 'setId', { unique: false })
      }

      // Historyjki
      if (!db.objectStoreNames.contains(STORES.STORIES)) {
        db.createObjectStore(STORES.STORIES, { keyPath: 'id' })
      }

      // Tłumaczenia (klucz: word_language_context)
      if (!db.objectStoreNames.contains(STORES.TRANSLATIONS)) {
        db.createObjectStore(STORES.TRANSLATIONS, { keyPath: 'key' })
      }

      // Metadata (np. last sync time)
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
      }
    }
  })

  return dbPromise
}

// Generic cache operations
async function getFromCache<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined
        if (!entry) {
          resolve(null)
          return
        }

        // Sprawdź czy nie wygasło
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          // Usuń wygasły wpis
          deleteFromCache(storeName, key)
          resolve(null)
          return
        }

        resolve(entry.data)
      }

      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function setInCache<T>(storeName: string, key: string, data: T, ttl: number): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)

      const entry: CacheEntry<T> & { id?: string; key?: string } = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      }

      // Dodaj klucz jako id lub key w zależności od store
      if (storeName === STORES.TRANSLATIONS || storeName === STORES.METADATA) {
        entry.key = key
      } else {
        entry.id = key
      }

      const request = store.put(entry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('[Cache] Error setting cache:', error)
  }
}

async function deleteFromCache(storeName: string, key: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.delete(key)
      tx.oncomplete = () => resolve()
    })
  } catch {
    // Ignore
  }
}

async function getAllFromCache<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result as CacheEntry<T>[]
        const now = Date.now()
        const validData = entries
          .filter((entry) => !entry.expiresAt || entry.expiresAt > now)
          .map((entry) => entry.data)
        resolve(validData)
      }

      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.clear()
      tx.oncomplete = () => resolve()
    })
  } catch {
    // Ignore
  }
}

// ============ SPECIFIC CACHE FUNCTIONS ============

// Zestawy fiszek
export interface CachedSet {
  id: string
  name: string
  language: string
  flashcardsCount?: number
  flashcards?: CachedFlashcard[]
}

export async function getCachedSets(): Promise<CachedSet[] | null> {
  return getAllFromCache<CachedSet>(STORES.SETS)
}

export async function getCachedSet(id: string): Promise<CachedSet | null> {
  return getFromCache<CachedSet>(STORES.SETS, id)
}

export async function setCachedSets(sets: CachedSet[]): Promise<void> {
  for (const set of sets) {
    await setInCache(STORES.SETS, set.id, set, CACHE_TTL.SETS)
  }
}

export async function setCachedSet(set: CachedSet): Promise<void> {
  await setInCache(STORES.SETS, set.id, set, CACHE_TTL.SETS)
}

export async function invalidateSetsCache(): Promise<void> {
  await clearStore(STORES.SETS)
}

// Fiszki
export interface CachedFlashcard {
  id: string
  setId: string
  word: string
  translation: string
  context?: string
  partOfSpeech?: string
  infinitive?: string
  infinitiveTranslation?: string
}

export async function getCachedFlashcards(setId: string): Promise<CachedFlashcard[] | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.FLASHCARDS, 'readonly')
      const store = tx.objectStore(STORES.FLASHCARDS)
      const index = store.index('setId')
      const request = index.getAll(setId)

      request.onsuccess = () => {
        const entries = request.result as (CacheEntry<CachedFlashcard> & { setId: string })[]
        const now = Date.now()
        const validData = entries
          .filter((entry) => !entry.expiresAt || entry.expiresAt > now)
          .map((entry) => entry.data)
        resolve(validData.length > 0 ? validData : null)
      }

      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setCachedFlashcards(flashcards: CachedFlashcard[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.FLASHCARDS, 'readwrite')
    const store = tx.objectStore(STORES.FLASHCARDS)

    for (const flashcard of flashcards) {
      const entry = {
        id: flashcard.id,
        setId: flashcard.setId,
        data: flashcard,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL.FLASHCARDS,
      }
      store.put(entry)
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve()
    })
  } catch (error) {
    console.error('[Cache] Error caching flashcards:', error)
  }
}

export async function invalidateFlashcardsCache(setId?: string): Promise<void> {
  if (setId) {
    // Usuń tylko fiszki z danego zestawu
    const flashcards = await getCachedFlashcards(setId)
    if (flashcards) {
      for (const f of flashcards) {
        await deleteFromCache(STORES.FLASHCARDS, f.id)
      }
    }
  } else {
    await clearStore(STORES.FLASHCARDS)
  }
}

// Historyjki
export interface CachedStory {
  id: string
  title: string
  content: string
  language: string
  difficulty: string
  wordCount: number
  vocabulary?: unknown
  createdAt?: string
}

export async function getCachedStories(): Promise<CachedStory[] | null> {
  const stories = await getAllFromCache<CachedStory>(STORES.STORIES)
  return stories.length > 0 ? stories : null
}

export async function getCachedStory(id: string): Promise<CachedStory | null> {
  return getFromCache<CachedStory>(STORES.STORIES, id)
}

export async function setCachedStories(stories: CachedStory[]): Promise<void> {
  for (const story of stories) {
    await setInCache(STORES.STORIES, story.id, story, CACHE_TTL.STORIES)
  }
}

export async function setCachedStory(story: CachedStory): Promise<void> {
  await setInCache(STORES.STORIES, story.id, story, CACHE_TTL.STORIES)
}

export async function invalidateStoriesCache(): Promise<void> {
  await clearStore(STORES.STORIES)
}

// Tłumaczenia - kluczowe dla szybkości!
export interface CachedTranslation {
  word: string
  translation: string
  partOfSpeech?: string
  infinitive?: string
  infinitiveTranslation?: string
  language: string
  context?: string
}

function getTranslationKey(word: string, language: string, context?: string): string {
  const normalizedWord = word.toLowerCase().trim()
  const normalizedContext = context ? context.toLowerCase().trim().slice(0, 50) : ''
  return `${normalizedWord}_${language}_${normalizedContext}`
}

export async function getCachedTranslation(
  word: string,
  language: string,
  context?: string
): Promise<CachedTranslation | null> {
  const key = getTranslationKey(word, language, context)
  return getFromCache<CachedTranslation>(STORES.TRANSLATIONS, key)
}

export async function setCachedTranslation(translation: CachedTranslation): Promise<void> {
  const key = getTranslationKey(translation.word, translation.language, translation.context)
  await setInCache(STORES.TRANSLATIONS, key, translation, CACHE_TTL.TRANSLATIONS)
}

export async function getCachedTranslations(): Promise<Map<string, CachedTranslation>> {
  const translations = await getAllFromCache<CachedTranslation>(STORES.TRANSLATIONS)
  const map = new Map<string, CachedTranslation>()
  for (const t of translations) {
    const key = getTranslationKey(t.word, t.language, t.context)
    map.set(key, t)
  }
  return map
}

// Metadata
export async function getLastSyncTime(): Promise<number | null> {
  const entry = await getFromCache<number>(STORES.METADATA, 'lastSync')
  return entry
}

export async function setLastSyncTime(): Promise<void> {
  await setInCache(STORES.METADATA, 'lastSync', Date.now(), Infinity)
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    clearStore(STORES.SETS),
    clearStore(STORES.FLASHCARDS),
    clearStore(STORES.STORIES),
    clearStore(STORES.TRANSLATIONS),
    clearStore(STORES.METADATA),
  ])
}
