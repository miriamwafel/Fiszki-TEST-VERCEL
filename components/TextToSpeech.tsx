'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface TextToSpeechProps {
  text: string
  language?: string
  autoPlay?: boolean
  onStart?: () => void
  onEnd?: () => void
}

// Mapowanie kodów języków na kody syntezy mowy
const speechLanguageCodes: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  pt: 'pt-PT',
  ru: 'ru-RU',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  nl: 'nl-NL',
  sv: 'sv-SE',
  no: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  cs: 'cs-CZ',
  uk: 'uk-UA',
  pl: 'pl-PL',
}

export function TextToSpeech({
  text,
  language = 'en',
  autoPlay = false,
  onStart,
  onEnd,
}: TextToSpeechProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (!window.speechSynthesis) {
      setIsSupported(false)
      return
    }

    // Pobierz dostępne głosy
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const findBestVoice = useCallback(
    (langCode: string): SpeechSynthesisVoice | null => {
      const targetLang = speechLanguageCodes[langCode] || langCode

      // Szukaj głosu dla danego języka
      let voice = voices.find(
        (v) => v.lang.startsWith(targetLang.split('-')[0]) && v.localService
      )
      if (!voice) {
        voice = voices.find((v) =>
          v.lang.startsWith(targetLang.split('-')[0])
        )
      }
      return voice || null
    },
    [voices]
  )

  const speak = useCallback(() => {
    if (!window.speechSynthesis || !text) return

    // Zatrzymaj poprzednie odtwarzanie
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)

    // Wykryj język na podstawie tekstu (prosty heurystyczny)
    // Jeśli tekst zawiera polskie znaki, użyj polskiego głosu dla tych fragmentów
    const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)

    if (hasPolish) {
      // Dla tekstu mieszanego, użyj polskiego głosu
      const polishVoice = findBestVoice('pl')
      if (polishVoice) {
        utterance.voice = polishVoice
        utterance.lang = 'pl-PL'
      }
    } else {
      // Użyj głosu docelowego języka
      const voice = findBestVoice(language)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      }
    }

    utterance.rate = 0.9 // Trochę wolniej dla lepszej zrozumiałości
    utterance.pitch = 1

    utterance.onstart = () => {
      setIsSpeaking(true)
      onStart?.()
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      onEnd?.()
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [text, language, findBestVoice, onStart, onEnd])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  // Auto-play gdy tekst się zmieni
  useEffect(() => {
    if (autoPlay && text && voices.length > 0) {
      // Małe opóźnienie dla pewności że głosy są załadowane
      const timer = setTimeout(() => {
        speak()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoPlay, text, voices.length, speak])

  if (!isSupported) {
    return null
  }

  return (
    <button
      onClick={isSpeaking ? stop : speak}
      className={`
        p-2 rounded-full transition-colors
        ${
          isSpeaking
            ? 'bg-primary-100 text-primary-600'
            : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
        }
      `}
      title={isSpeaking ? 'Zatrzymaj' : 'Odtwórz'}
    >
      {isSpeaking ? (
        // Ikona stop z animacją
        <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // Ikona głośnika
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
    </button>
  )
}

// Hook do używania TTS programowo
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = useCallback((text: string, lang: string = 'en') => {
    if (!window.speechSynthesis) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const langCode = speechLanguageCodes[lang] || lang

    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((v) => v.lang.startsWith(langCode.split('-')[0]))
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }

    utterance.rate = 0.9
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}
