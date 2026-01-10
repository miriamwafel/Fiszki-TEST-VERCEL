'use client'

import { useEffect, useCallback } from 'react'

/**
 * System kontekstu strony dla AI Chat.
 *
 * Pozwala stronom zarejestrować swoją zawartość, którą AI może wykorzystać
 * do lepszego zrozumienia pytań użytkownika.
 *
 * Przykład użycia:
 * ```tsx
 * usePageContent({
 *   type: 'flashcards',
 *   title: 'Zestaw: Hiszpański B2',
 *   language: 'es',
 *   content: flashcards.map(f => ({ word: f.front, translation: f.back }))
 * })
 * ```
 */

export interface FlashcardContent {
  word: string
  translation: string
  example?: string
}

export interface StoryContent {
  title: string
  language: string
  level: string
  text: string
  vocabulary?: { word: string; translation: string }[]
}

export interface GrammarContent {
  title: string
  language: string
  level: string
  topic: string
  explanation?: string
  examples?: string[]
}

export interface PageContentData {
  type: 'flashcards' | 'story' | 'grammar' | 'exercise' | 'practice'
  title: string
  language?: string
  level?: string
  /** Dla fiszek - lista słówek */
  flashcards?: FlashcardContent[]
  /** Dla historyjek - treść */
  story?: StoryContent
  /** Dla gramatyki - wyjaśnienie */
  grammar?: GrammarContent
  /** Dowolne dodatkowe info */
  additionalContext?: string
}

const PAGE_CONTENT_EVENT = 'page-content-updated'
const PAGE_CONTENT_CLEAR_EVENT = 'page-content-cleared'

/**
 * Emituje aktualizację zawartości strony.
 * AI Chat nasłuchuje tego eventu i używa danych do kontekstu.
 */
export function emitPageContent(data: PageContentData) {
  if (typeof window === 'undefined') return

  const event = new CustomEvent(PAGE_CONTENT_EVENT, { detail: data })
  window.dispatchEvent(event)
}

/**
 * Czyści zawartość strony (np. przy unmount).
 */
export function clearPageContent() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(PAGE_CONTENT_CLEAR_EVENT))
}

/**
 * Hook do rejestrowania zawartości strony dla AI Chat.
 * Automatycznie czyści kontekst przy unmount.
 */
export function usePageContent(data: PageContentData | null) {
  useEffect(() => {
    if (data) {
      emitPageContent(data)
    }

    return () => {
      clearPageContent()
    }
  }, [data])
}

/**
 * Hook do nasłuchiwania zmian zawartości strony (dla AIChatWidget).
 */
export function usePageContentListener(
  onContentUpdate: (data: PageContentData | null) => void
) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUpdate = (e: CustomEvent<PageContentData>) => {
      onContentUpdate(e.detail)
    }

    const handleClear = () => {
      onContentUpdate(null)
    }

    window.addEventListener(PAGE_CONTENT_EVENT, handleUpdate as EventListener)
    window.addEventListener(PAGE_CONTENT_CLEAR_EVENT, handleClear)

    return () => {
      window.removeEventListener(PAGE_CONTENT_EVENT, handleUpdate as EventListener)
      window.removeEventListener(PAGE_CONTENT_CLEAR_EVENT, handleClear)
    }
  }, [onContentUpdate])
}

/**
 * Formatuje zawartość strony do tekstu dla AI.
 */
export function formatPageContentForAI(data: PageContentData | null): string {
  if (!data) return ''

  let content = `\n\n--- ZAWARTOŚĆ STRONY ---\n`
  content += `Typ: ${data.type}\n`
  content += `Tytuł: ${data.title}\n`

  if (data.language) {
    content += `Język: ${data.language}\n`
  }
  if (data.level) {
    content += `Poziom: ${data.level}\n`
  }

  // Fiszki
  if (data.flashcards && data.flashcards.length > 0) {
    content += `\nSłówka z tego zestawu (${data.flashcards.length}):\n`
    // Limit to first 30 for context size
    const flashcardsToShow = data.flashcards.slice(0, 30)
    for (const fc of flashcardsToShow) {
      content += `• ${fc.word} = ${fc.translation}`
      if (fc.example) {
        content += ` (np. "${fc.example}")`
      }
      content += '\n'
    }
    if (data.flashcards.length > 30) {
      content += `... i ${data.flashcards.length - 30} więcej\n`
    }
  }

  // Historia
  if (data.story) {
    content += `\nHistoryjka:\n`
    content += `Tytuł: ${data.story.title}\n`
    content += `Język: ${data.story.language}, Poziom: ${data.story.level}\n`
    // Limit story text
    const storyText = data.story.text.length > 2000
      ? data.story.text.slice(0, 2000) + '...'
      : data.story.text
    content += `Treść:\n${storyText}\n`

    if (data.story.vocabulary && data.story.vocabulary.length > 0) {
      content += `\nSłownictwo z historyjki:\n`
      for (const v of data.story.vocabulary.slice(0, 20)) {
        content += `• ${v.word} = ${v.translation}\n`
      }
    }
  }

  // Gramatyka
  if (data.grammar) {
    content += `\nTemat gramatyczny: ${data.grammar.topic}\n`
    if (data.grammar.explanation) {
      const explanation = data.grammar.explanation.length > 1500
        ? data.grammar.explanation.slice(0, 1500) + '...'
        : data.grammar.explanation
      content += `Wyjaśnienie:\n${explanation}\n`
    }
    if (data.grammar.examples && data.grammar.examples.length > 0) {
      content += `Przykłady:\n`
      for (const ex of data.grammar.examples.slice(0, 10)) {
        content += `• ${ex}\n`
      }
    }
  }

  if (data.additionalContext) {
    content += `\nDodatkowy kontekst: ${data.additionalContext}\n`
  }

  content += `\nUWAGA: Użytkownik widzi tę zawartość na stronie. Jeśli pyta o słówko, sprawdź czy jest w zestawie i użyj kontekstu. NIE podpowiadaj proaktywnie - odpowiadaj tylko na pytania.\n`

  return content
}
