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

export function TutorView({ set }: { set: FlashcardSet }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [config, setConfig] = useState<{ apiKey: string; model: string } | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastTextRef = useRef('')
  const hasTriedConnect = useRef(false)

  const langName = languageNames[set.language] || set.language

  // Systemowa instrukcja dla AI
  const systemInstruction = `Jesteś przyjaznym nauczycielem języka ${langName} dla polskiego ucznia.

Twoja rola:
1. Prowadź naturalną rozmowę głosową w języku ${langName}, mieszając z polskim gdy tłumaczysz
2. Poprawiaj błędy ucznia - wyjaśniaj po polsku co było źle
3. Używaj słownictwa z fiszek ucznia: ${set.flashcards.slice(0, 15).map(f => `${f.word} (${f.translation})`).join(', ')}
4. Mów naturalnie, jak w rozmowie
5. Odpowiadaj krótko (1-3 zdania)
6. Zachęcaj ucznia do mówienia w języku ${langName}

WAŻNE: To jest rozmowa głosowa w czasie rzeczywistym. Odpowiadaj naturalnie i zwięźle.`

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
    currentText,
    audioQueue,
    clearAudioQueue,
    isModelSpeaking,
  } = useLiveAPI({
    apiKey: config?.apiKey || '',
    model: config?.model || 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    systemInstruction,
  })

  // Scrolluj do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentText])

  // Aktualizuj wiadomości gdy AI skończy mówić
  useEffect(() => {
    if (!isModelSpeaking && currentText && currentText !== lastTextRef.current) {
      // AI skończyło mówić - dodaj wiadomość
      setMessages(prev => [...prev, { role: 'tutor', content: currentText }])
      lastTextRef.current = currentText
    }
  }, [currentText, isModelSpeaking])

  // Połącz po załadowaniu konfiguracji (tylko raz)
  useEffect(() => {
    if (config && !hasTriedConnect.current && connectionState === 'disconnected') {
      hasTriedConnect.current = true
      connect()
    }
  }, [config, connectionState, connect])

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

  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording)
  }, [])

  const handleAudioPlayed = useCallback(() => {
    clearAudioQueue()
  }, [clearAudioQueue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || connectionState !== 'connected') return

    // Dodaj wiadomość użytkownika
    setMessages(prev => [...prev, { role: 'user', content: inputText.trim() }])

    // Wyślij do Gemini
    sendText(inputText.trim())
    setInputText('')
  }

  const handleStartConversation = () => {
    if (connectionState === 'connected') {
      sendText('Cześć! Rozpocznijmy naukę.')
    }
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
            Zestaw: {set.name} • Język: {langName}
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
        <div className="h-[350px] overflow-y-auto p-4 space-y-4">
          {connectionState === 'error' && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">
                Nie udało się połączyć z Gemini Live API.
                <br />
                <span className="text-sm text-gray-500">
                  Upewnij się, że Twój klucz API ma dostęp do Live API.
                </span>
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

          {messages.length === 0 && connectionState === 'connected' && (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                Kliknij mikrofon i zacznij mówić, aby rozpocząć rozmowę
              </p>
              <Button onClick={handleStartConversation} variant="secondary">
                Lub kliknij tutaj aby AI zaczęło
              </Button>
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

          {/* Aktualny tekst AI (streaming) */}
          {isModelSpeaking && currentText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-gray-100 text-gray-900">
                <p>{currentText}</p>
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              </div>
            </div>
          )}

          {/* Indykator mówienia AI */}
          {isModelSpeaking && !currentText && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
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

      {/* Voice recorder */}
      <Card className="p-6 mb-4">
        <LiveAudioRecorder
          onAudioData={handleAudioData}
          isRecording={isRecording}
          onRecordingChange={handleRecordingChange}
          disabled={connectionState !== 'connected'}
        />
      </Card>

      {/* Text input fallback */}
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Lub wpisz wiadomość..."
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
      <div className="mt-4 text-center text-sm text-gray-500">
        <p>
          Rozmowa w czasie rzeczywistym przez Gemini Live API.
          <br />
          Mów naturalnie - AI odpowiada natychmiast. Możesz przerwać AI w każdej chwili.
        </p>
      </div>
    </div>
  )
}
