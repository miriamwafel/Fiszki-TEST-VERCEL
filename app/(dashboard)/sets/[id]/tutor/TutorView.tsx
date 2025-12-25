'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useLiveAPI } from '@/lib/useLiveAPI'
import { LiveAudioRecorder } from '@/components/LiveAudioRecorder'
import { LiveAudioPlayer } from '@/components/LiveAudioPlayer'

interface Flashcard {
  id: string
  word: string
  translation: string
}

interface FlashcardSet {
  id: string
  name: string
  language: string
  flashcards: Flashcard[]
}

interface Message {
  role: 'user' | 'tutor'
  content: string
}

type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

const languageNames: Record<string, string> = {
  en: 'angielski',
  de: 'niemiecki',
  es: 'hiszpański',
  fr: 'francuski',
  it: 'włoski',
  pt: 'portugalski',
  ru: 'rosyjski',
  ja: 'japoński',
  ko: 'koreański',
  zh: 'chiński',
  nl: 'holenderski',
  sv: 'szwedzki',
  no: 'norweski',
  da: 'duński',
  fi: 'fiński',
  cs: 'czeski',
  uk: 'ukraiński',
}

const levelDescriptions: Record<LanguageLevel, string> = {
  A1: 'Początkujący - dużo polskiego, proste słowa',
  A2: 'Podstawowy - polski z prostymi zdaniami',
  B1: 'Średniozaawansowany - mix języków',
  B2: 'Wyższy średni - głównie język obcy',
  C1: 'Zaawansowany - prawie tylko język obcy',
  C2: 'Biegły - pełna konwersacja w języku obcym',
}

export function TutorView({ set }: { set: FlashcardSet }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isConversationActive, setIsConversationActive] = useState(false)
  const [config, setConfig] = useState<{ apiKey: string; model: string } | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LanguageLevel | null>(null)
  const [userTranscript, setUserTranscript] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasTriedConnect = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const lastFinalTranscriptRef = useRef('')

  const langName = languageNames[set.language] || set.language

  // Systemowa instrukcja dla AI
  const getSystemInstruction = (selectedLevel: LanguageLevel) => {
    const levelInstructions: Record<LanguageLevel, string> = {
      A1: `Mów GŁÓWNIE po polsku. Wprowadzaj tylko pojedyncze słowa w języku ${langName}.
Tłumacz wszystko natychmiast. Używaj bardzo prostych słów i krótkich zdań.
Zachęcaj ucznia do powtarzania słów. Bądź bardzo cierpliwy i pomocny.`,
      A2: `Mów głównie po polsku, ale używaj prostych zwrotów w języku ${langName}.
Zawsze tłumacz nowe słowa. Używaj prostej gramatyki.
Pomagaj z wymową i budowaniem prostych zdań.`,
      B1: `Mieszaj polski z językiem ${langName} - około 50/50.
Używaj prostych zdań w języku ${langName}, trudniejsze rzeczy wyjaśniaj po polsku.
Poprawiaj błędy i wyjaśniaj gramatykę gdy trzeba.`,
      B2: `Mów głównie w języku ${langName}, polski tylko gdy uczeń nie rozumie.
Używaj bardziej złożonych zdań i idiomów.
Poprawiaj błędy krótko, w języku ${langName}.`,
      C1: `Mów prawie wyłącznie w języku ${langName}.
Używaj zaawansowanego słownictwa, idiomów i złożonych konstrukcji.
Polski tylko w wyjątkowych sytuacjach.`,
      C2: `Mów TYLKO w języku ${langName}, jak native speaker.
Używaj naturalnego, potocznego języka z idiomami i slangiem.
Rozmawiaj jak z przyjacielem, nie jak z uczniem.`,
    }

    return `Jesteś przyjaznym nauczycielem języka ${langName} dla polskiego ucznia na poziomie ${selectedLevel}.

ZAWSZE ZACZNIJ rozmowę po polsku, przedstawiając się i pytając czego uczeń chce się dziś nauczyć.

Poziom ucznia (${selectedLevel}): ${levelInstructions[selectedLevel]}

Twoja rola:
1. Prowadź naturalną rozmowę dostosowaną do poziomu ${selectedLevel}
2. Poprawiaj błędy ucznia - na niższych poziomach (A1-B1) wyjaśniaj po polsku, na wyższych w języku ${langName}
3. Używaj słownictwa z fiszek ucznia: ${set.flashcards.slice(0, 15).map(f => `${f.word} (${f.translation})`).join(', ')}
4. Odpowiadaj krótko (1-3 zdania)
5. Zachęcaj ucznia do mówienia

WAŻNE:
- To jest rozmowa głosowa w czasie rzeczywistym
- Zacznij od przywitania PO POLSKU i zapytaj czego uczeń chce się nauczyć
- Bądź naturalny i wspierający
- Możesz być przerywany w trakcie mówienia - to normalne w rozmowie`
  }

  // Inicjalizacja Web Speech API dla transkrypcji
  const [speechSupported, setSpeechSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported')
      setSpeechSupported(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      // Ustaw język na język zestawu (lepsze rozpoznawanie)
      recognition.lang = set.language === 'en' ? 'en-US' :
                         set.language === 'de' ? 'de-DE' :
                         set.language === 'es' ? 'es-ES' :
                         set.language === 'fr' ? 'fr-FR' :
                         set.language === 'it' ? 'it-IT' :
                         set.language === 'pt' ? 'pt-PT' :
                         'en-US'

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        // Pokazuj bieżącą transkrypcję
        setUserTranscript(interimTranscript || finalTranscript)

        // Gdy mamy finalny tekst, dodaj jako wiadomość
        if (finalTranscript && finalTranscript !== lastFinalTranscriptRef.current) {
          lastFinalTranscriptRef.current = finalTranscript
          setMessages(prev => [...prev, { role: 'user', content: finalTranscript.trim() }])
          setUserTranscript('')
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        // Restart przy niektórych błędach
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // Ignoruj - to normalne
        }
      }

      recognition.onend = () => {
        // Automatyczny restart jeśli rozmowa aktywna
        if (isConversationActive && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {
            // Już uruchomione
          }
        }
      }

      recognitionRef.current = recognition
      setSpeechSupported(true)
    } catch (error) {
      console.warn('Failed to initialize Speech Recognition:', error)
      setSpeechSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Ignore
        }
      }
    }
  }, [set.language, isConversationActive])

  // Start/stop speech recognition gdy rozmowa się zmienia
  useEffect(() => {
    if (!recognitionRef.current) return

    if (isConversationActive) {
      try {
        lastFinalTranscriptRef.current = ''
        recognitionRef.current.start()
      } catch {
        // Already started
      }
    } else {
      try {
        recognitionRef.current.stop()
      } catch {
        // Already stopped
      }
      setUserTranscript('')
    }
  }, [isConversationActive])

  // Pobierz konfigurację API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/tutor/config')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error)
        }

        setConfig(data)
      } catch (err) {
        console.error('Failed to fetch config:', err)
        setError('Nie udało się pobrać konfiguracji')
      } finally {
        setConfigLoading(false)
      }
    }

    fetchConfig()
  }, [])

  // Live API hook
  const {
    connect,
    disconnect,
    sendAudio,
    sendText,
    connectionState,
    audioQueue,
    clearAudioQueue,
    isModelSpeaking,
  } = useLiveAPI({
    apiKey: config?.apiKey || '',
    model: config?.model || 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    systemInstruction: level ? getSystemInstruction(level) : '',
  })

  // Scrolluj do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, userTranscript, isModelSpeaking])

  // Połącz po załadowaniu konfiguracji I wybraniu poziomu
  useEffect(() => {
    if (config && level && !hasTriedConnect.current && connectionState === 'disconnected') {
      hasTriedConnect.current = true
      connect()
    }
  }, [config, level, connectionState, connect])

  // Auto-start AI greeting po połączeniu
  const hasGreetedRef = useRef(false)
  useEffect(() => {
    if (connectionState === 'connected' && level && !hasGreetedRef.current) {
      hasGreetedRef.current = true
      setTimeout(() => {
        sendText(`Cześć! Jestem gotowy do nauki języka ${langName} na poziomie ${level}.`)
      }, 500)
    }
  }, [connectionState, level, langName, sendText])

  // Cleanup
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const handleAudioData = useCallback(
    (data: ArrayBuffer) => {
      if (connectionState === 'connected') {
        sendAudio(data)
      }
    },
    [connectionState, sendAudio]
  )

  const handleConversationChange = useCallback((active: boolean) => {
    setIsConversationActive(active)
  }, [])

  const handleAudioPlayed = useCallback(() => {
    clearAudioQueue()
  }, [clearAudioQueue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || connectionState !== 'connected') return

    setMessages(prev => [...prev, { role: 'user', content: inputText.trim() }])
    sendText(inputText.trim())
    setInputText('')
  }

  if (configLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            <span className="ml-3 text-gray-500">Ładowanie...</span>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="p-8 bg-red-50">
          <p className="text-red-600 text-center">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4 mx-auto block">
            Odśwież stronę
          </Button>
        </Card>
      </div>
    )
  }

  // Ekran wyboru poziomu
  if (!level) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/sets/${set.id}`}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Powrót do zestawu
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Rozmowa z AI Tutorem
          </h1>
          <p className="text-gray-500">
            Zestaw: {set.name} • Język: {langName}
          </p>
        </div>

        <Card className="p-8">
          <h2 className="text-xl font-semibold text-center mb-2">
            Wybierz swój poziom języka {langName}
          </h2>
          <p className="text-gray-500 text-center mb-6">
            Dostosujemy rozmowę do Twoich umiejętności
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(levelDescriptions) as LanguageLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-primary-500
                         hover:bg-primary-50 transition-all text-left group"
              >
                <span className="text-2xl font-bold text-primary-600 group-hover:text-primary-700">
                  {lvl}
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  {levelDescriptions[lvl]}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Wskazówka:</strong> Jeśli nie wiesz, zacznij od B1 - to dobry poziom dla osób
              które znają podstawy ale chcą ćwiczyć konwersację.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/sets/${set.id}`}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Powrót do zestawu
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Rozmowa Live z AI Tutorem
          </h1>
          <p className="text-gray-500">
            Zestaw: {set.name} • Język: {langName} •{' '}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
              Poziom {level}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              connectionState === 'connected'
                ? 'bg-green-500'
                : connectionState === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-500">
            {connectionState === 'connected'
              ? 'Połączono'
              : connectionState === 'connecting'
              ? 'Łączenie...'
              : 'Rozłączono'}
          </span>
        </div>
      </div>

      {/* Flashcards info */}
      {set.flashcards.length > 0 && (
        <Card className="p-4 mb-4 bg-primary-50 border-primary-200">
          <p className="text-sm text-primary-700">
            <strong>Słownictwo:</strong>{' '}
            {set.flashcards.slice(0, 5).map((f) => f.word).join(', ')}
            {set.flashcards.length > 5 && ` i ${set.flashcards.length - 5} więcej...`}
          </p>
        </Card>
      )}

      {/* Chat area */}
      <Card className="mb-4">
        <div className="h-[300px] overflow-y-auto p-4 space-y-4">
          {connectionState === 'error' && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">
                Nie udało się połączyć z Gemini Live API.
              </p>
              <Button
                onClick={() => {
                  hasTriedConnect.current = false
                  connect()
                }}
                variant="secondary"
              >
                Spróbuj ponownie
              </Button>
            </div>
          )}

          {messages.length === 0 && connectionState === 'connected' && !isModelSpeaking && !isConversationActive && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Kliknij przycisk poniżej aby rozpocząć rozmowę z AI Tutorem
              </p>
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3" />
              <p className="text-gray-500">Łączenie z AI...</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                <p>{message.content}</p>
              </div>
            </div>
          ))}

          {/* Wskaźnik że AI mówi */}
          {isModelSpeaking && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm text-gray-600">Nauczyciel mówi...</span>
                </div>
              </div>
            </div>
          )}

          {/* Transkrypcja użytkownika na żywo */}
          {isConversationActive && userTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 bg-primary-300 text-white">
                <p className="opacity-90">{userTranscript}</p>
                <span className="inline-block w-2 h-4 bg-white/50 animate-pulse ml-1" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* Audio Player */}
      <LiveAudioPlayer
        audioQueue={audioQueue}
        onAudioPlayed={handleAudioPlayed}
      />

      {/* Voice recorder - główny interfejs */}
      <Card className="p-6 mb-4">
        <LiveAudioRecorder
          onAudioData={handleAudioData}
          isActive={isConversationActive}
          onActiveChange={handleConversationChange}
          disabled={connectionState !== 'connected'}
        />
      </Card>

      {/* Text input - zapasowe wejście */}
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Lub wpisz wiadomość tekstową..."
              disabled={connectionState !== 'connected'}
            />
          </div>
          <Button
            type="submit"
            disabled={!inputText.trim() || connectionState !== 'connected'}
          >
            Wyślij
          </Button>
        </form>
      </Card>

      {/* Tips */}
      <div className="mt-4 text-center text-sm text-gray-500 space-y-1">
        <p>
          <strong>Tryb rozmowy ciągłej</strong> - kliknij raz aby zacząć, kliknij ponownie aby zakończyć.
        </p>
        <p>
          Mów naturalnie, możesz przerywać AI w każdej chwili.
        </p>
        {!speechSupported && (
          <p className="text-xs text-gray-400">
            Transkrypcja mowy niedostępna na tym urządzeniu, ale AI Cię słyszy.
          </p>
        )}
      </div>
    </div>
  )
}
