'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Typy dla Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface VoiceRecorderProps {
  onResult: (transcript: string) => void
  onError?: (error: string) => void
  language?: string
  disabled?: boolean
}

// Mapowanie kodów języków na kody rozpoznawania mowy
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

export function VoiceRecorder({
  onResult,
  onError,
  language = 'en',
  disabled = false,
}: VoiceRecorderProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    // Sprawdź wsparcie dla Web Speech API
    const SpeechRecognitionAPI = (
      window.SpeechRecognition || window.webkitSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined

    if (!SpeechRecognitionAPI) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    // Pozwól na rozpoznawanie zarówno języka docelowego jak i polskiego
    recognition.lang = speechLanguageCodes[language] || 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      setInterimTranscript(interim)

      if (final) {
        onResult(final.trim())
        setInterimTranscript('')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        onError?.('Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.')
      } else if (event.error === 'no-speech') {
        // Ignoruj - to normalne gdy użytkownik milczy
      } else {
        onError?.(`Błąd rozpoznawania mowy: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      // Automatycznie restartuj jeśli wciąż nasłuchujemy
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch {
          // Ignoruj błędy restartu
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [language, onResult, onError, isListening])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !disabled) {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Failed to start recognition:', error)
      }
    }
  }, [disabled])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      setInterimTranscript('')
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (!isSupported) {
    return (
      <div className="text-center p-4 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700 text-sm">
          Twoja przeglądarka nie obsługuje rozpoznawania mowy.
          <br />
          Użyj Chrome, Edge lub Safari.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={toggleListening}
        disabled={disabled}
        className={`
          relative w-20 h-20 rounded-full transition-all duration-300
          flex items-center justify-center
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
              : 'bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/30'
          }
        `}
      >
        {/* Animowany ring podczas nagrywania */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
            <span className="absolute inset-2 rounded-full bg-red-400 animate-pulse opacity-50" />
          </>
        )}

        {/* Ikona mikrofonu */}
        <svg
          className="w-8 h-8 text-white relative z-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isListening ? (
            // Ikona stop
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
            />
          ) : (
            // Ikona mikrofonu
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          )}
        </svg>
      </button>

      <p className="text-sm text-gray-500">
        {isListening ? 'Mów teraz... (kliknij aby zatrzymać)' : 'Kliknij aby mówić'}
      </p>

      {/* Podgląd tekstu podczas mówienia */}
      {interimTranscript && (
        <div className="text-center p-3 bg-gray-100 rounded-lg max-w-md">
          <p className="text-gray-600 italic">{interimTranscript}...</p>
        </div>
      )}
    </div>
  )
}

// Deklaracja typów dla Web Speech API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}
