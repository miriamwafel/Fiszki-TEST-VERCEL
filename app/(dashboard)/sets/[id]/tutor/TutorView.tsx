'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { TextToSpeech, useSpeech } from '@/components/TextToSpeech'

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
  correction?: string
  vocabulary?: { word: string; translation: string }[]
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
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { speak, isSpeaking } = useSpeech()

  const langName = languageNames[set.language] || set.language

  // Scrolluj do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Rozpocznij rozmowę przy pierwszym załadowaniu
  useEffect(() => {
    const startConversation = async () => {
      try {
        const response = await fetch('/api/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setId: set.id }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error)
        }

        const tutorMessage: Message = {
          role: 'tutor',
          content: data.response,
          vocabulary: data.vocabulary,
        }

        setMessages([tutorMessage])

        // Automatycznie odczytaj powitanie
        if (autoSpeak) {
          speak(data.response, set.language)
        }
      } catch (err) {
        console.error('Failed to start conversation:', err)
        setError('Nie udało się rozpocząć rozmowy. Spróbuj odświeżyć stronę.')
      } finally {
        setInitialLoading(false)
      }
    }

    startConversation()
  }, [set.id, set.language, autoSpeak, speak])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInputText('')
    setLoading(true)
    setError(null)

    try {
      // Przygotuj historię rozmowy
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: set.id,
          message: text.trim(),
          conversationHistory,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      const tutorMessage: Message = {
        role: 'tutor',
        content: data.response,
        correction: data.correction,
        vocabulary: data.vocabulary,
      }

      setMessages((prev) => [...prev, tutorMessage])

      // Automatycznie odczytaj odpowiedź
      if (autoSpeak) {
        speak(data.response, set.language)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Nie udało się wysłać wiadomości. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceResult = (transcript: string) => {
    sendMessage(transcript)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputText)
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
            Rozmowa z AI Tutorem
          </h1>
          <p className="text-gray-500">
            Zestaw: {set.name} • Język: {langName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Auto-odtwarzanie
          </label>
        </div>
      </div>

      {/* Flashcards info */}
      {set.flashcards.length > 0 && (
        <Card className="p-4 mb-4 bg-primary-50 border-primary-200">
          <p className="text-sm text-primary-700">
            <strong>Fiszki do ćwiczenia:</strong>{' '}
            {set.flashcards.slice(0, 5).map((f) => f.word).join(', ')}
            {set.flashcards.length > 5 && ` i ${set.flashcards.length - 5} więcej...`}
          </p>
        </Card>
      )}

      {/* Chat area */}
      <Card className="mb-4">
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {initialLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3" />
                <p className="text-gray-500">Łączenie z nauczycielem...</p>
              </div>
            </div>
          ) : (
            <>
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
                    <div className="flex items-start gap-2">
                      <p className="flex-1">{message.content}</p>
                      {message.role === 'tutor' && (
                        <TextToSpeech
                          text={message.content}
                          language={set.language}
                        />
                      )}
                    </div>

                    {/* Korekta błędów */}
                    {message.correction && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-sm text-orange-700 bg-orange-50 rounded px-2 py-1">
                          <strong>Korekta:</strong> {message.correction}
                        </p>
                      </div>
                    )}

                    {/* Nowe słownictwo */}
                    {message.vocabulary && message.vocabulary.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Nowe słowa:</p>
                        <div className="flex flex-wrap gap-1">
                          {message.vocabulary.map((v, i) => (
                            <span
                              key={i}
                              className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5"
                            >
                              {v.word} = {v.translation}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
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
                      <span className="text-gray-500 text-sm">
                        Nauczyciel pisze...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-center">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </Card>

      {/* Voice recorder */}
      <Card className="p-6 mb-4">
        <VoiceRecorder
          onResult={handleVoiceResult}
          onError={(err) => setError(err)}
          language={set.language}
          disabled={loading || initialLoading}
        />
        {isSpeaking && (
          <p className="text-center text-sm text-primary-600 mt-2">
            Nauczyciel mówi...
          </p>
        )}
      </Card>

      {/* Text input fallback */}
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Lub wpisz wiadomość..."
              disabled={loading || initialLoading}
            />
          </div>
          <Button
            type="submit"
            loading={loading}
            disabled={!inputText.trim() || initialLoading}
          >
            Wyślij
          </Button>
        </form>
      </Card>

      {/* Tips */}
      <div className="mt-4 text-center text-sm text-gray-500">
        <p>
          Wskazówka: Kliknij mikrofon i mów po polsku lub w języku {langName}.
          <br />
          Nauczyciel poprawi Twoje błędy i pomoże Ci ćwiczyć słownictwo z fiszek.
        </p>
      </div>
    </div>
  )
}
