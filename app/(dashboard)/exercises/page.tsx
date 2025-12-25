'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Card } from '@/components/Card'

interface FlashcardSet {
  id: string
  name: string
  language: string
  _count: { flashcards: number }
}

interface Flashcard {
  id: string
  word: string
  translation: string
}

interface GapExercise {
  sentence: string
  word: string
  hint: string
}

interface SentenceExercise {
  targetWord: string
  contextWords: string[]
  exampleSentence: string
  hint: string
}

type ExerciseType = 'gap' | 'sentence'

export default function ExercisesPage() {
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)

  const [exerciseType, setExerciseType] = useState<ExerciseType>('gap')
  const [currentFlashcard, setCurrentFlashcard] = useState<Flashcard | null>(null)
  const [gapExercise, setGapExercise] = useState<GapExercise | null>(null)
  const [sentenceExercise, setSentenceExercise] = useState<SentenceExercise | null>(null)
  const [generating, setGenerating] = useState(false)

  const [gapAnswer, setGapAnswer] = useState('')
  const [gapResult, setGapResult] = useState<'correct' | 'incorrect' | null>(null)

  const [sentenceAnswer, setSentenceAnswer] = useState('')
  const [sentenceResult, setSentenceResult] = useState<{
    correct: boolean
    feedback: string
    correctedSentence?: string
  } | null>(null)
  const [checkingSentence, setCheckingSentence] = useState(false)

  useEffect(() => {
    fetchSets()
  }, [])

  useEffect(() => {
    if (selectedSetId) {
      fetchFlashcards()
    }
  }, [selectedSetId])

  const fetchSets = async () => {
    try {
      const response = await fetch('/api/sets')
      const data = await response.json()
      setSets(data.filter((s: FlashcardSet) => s._count.flashcards > 0))
    } catch (error) {
      console.error('Failed to fetch sets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFlashcards = async () => {
    try {
      const response = await fetch(`/api/sets/${selectedSetId}`)
      const data = await response.json()
      setFlashcards(data.flashcards)
    } catch (error) {
      console.error('Failed to fetch flashcards:', error)
    }
  }

  const getRandomFlashcard = () => {
    if (flashcards.length === 0) return null
    const randomIndex = Math.floor(Math.random() * flashcards.length)
    return flashcards[randomIndex]
  }

  const generateExercise = async () => {
    const flashcard = getRandomFlashcard()
    if (!flashcard) return

    setCurrentFlashcard(flashcard)
    setGenerating(true)
    setGapResult(null)
    setSentenceResult(null)
    setGapAnswer('')
    setSentenceAnswer('')

    const set = sets.find((s) => s.id === selectedSetId)

    try {
      if (exerciseType === 'gap') {
        const response = await fetch('/api/exercises/gap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: flashcard.word,
            translation: flashcard.translation,
            language: set?.language,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error)
        }

        setGapExercise(data)
        setSentenceExercise(null)
      } else {
        const response = await fetch('/api/exercises/sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: flashcard.word,
            translation: flashcard.translation,
            language: set?.language,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error)
        }

        setSentenceExercise(data)
        setGapExercise(null)
      }
    } catch (error) {
      console.error('Failed to generate exercise:', error)
      alert('Wystąpił błąd podczas generowania ćwiczenia')
    } finally {
      setGenerating(false)
    }
  }

  const checkGapAnswer = () => {
    if (!gapExercise) return

    const normalizedAnswer = gapAnswer.trim().toLowerCase()
    const normalizedWord = gapExercise.word.toLowerCase()

    setGapResult(normalizedAnswer === normalizedWord ? 'correct' : 'incorrect')
  }

  const checkSentenceAnswer = async () => {
    if (!sentenceExercise || !sentenceAnswer.trim()) return

    const set = sets.find((s) => s.id === selectedSetId)

    setCheckingSentence(true)
    try {
      const response = await fetch('/api/exercises/sentence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: sentenceAnswer,
          targetWord: sentenceExercise.targetWord,
          contextWords: sentenceExercise.contextWords,
          language: set?.language,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSentenceResult(data)
    } catch (error) {
      console.error('Failed to check sentence:', error)
      alert('Wystąpił błąd podczas sprawdzania zdania')
    } finally {
      setCheckingSentence(false)
    }
  }

  const renderGapSentence = () => {
    if (!gapExercise) return null

    const parts = gapExercise.sentence.split('_____')

    return (
      <p className="text-lg text-gray-700">
        {parts[0]}
        <input
          type="text"
          value={gapAnswer}
          onChange={(e) => setGapAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !gapResult) {
              checkGapAnswer()
            }
          }}
          disabled={!!gapResult}
          className={`gap-input ${gapResult || ''}`}
          autoFocus
        />
        {parts[1]}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ćwiczenia</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Wybierz zestaw i typ ćwiczenia
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Select
            id="set"
            label="Zestaw"
            value={selectedSetId}
            onChange={(e) => setSelectedSetId(e.target.value)}
            options={[
              { value: '', label: 'Wybierz zestaw...' },
              ...sets.map((set) => ({
                value: set.id,
                label: `${set.name} (${set._count.flashcards} fiszek)`,
              })),
            ]}
          />

          <Select
            id="type"
            label="Typ ćwiczenia"
            value={exerciseType}
            onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
            options={[
              { value: 'gap', label: 'Uzupełnianie luk' },
              { value: 'sentence', label: 'Układanie zdań' },
            ]}
          />
        </div>

        <Button
          onClick={generateExercise}
          disabled={!selectedSetId}
          loading={generating}
        >
          {gapExercise || sentenceExercise ? 'Następne ćwiczenie' : 'Generuj ćwiczenie'}
        </Button>
      </Card>

      {/* Gap exercise */}
      {gapExercise && (
        <Card className="p-6 mb-6">
          <div className="mb-4">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Uzupełnianie luk
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Uzupełnij lukę odpowiednim słowem:{' '}
            <span className="font-medium">{currentFlashcard?.translation}</span>
          </p>

          {renderGapSentence()}

          <p className="text-sm text-gray-400 mt-2 italic">
            Podpowiedź: {gapExercise.hint}
          </p>

          {!gapResult && (
            <div className="mt-4">
              <Button onClick={checkGapAnswer}>Sprawdź</Button>
            </div>
          )}

          {gapResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                gapResult === 'correct'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {gapResult === 'correct' ? (
                <p className="font-semibold">Poprawnie!</p>
              ) : (
                <div>
                  <p className="font-semibold mb-1">Niepoprawnie</p>
                  <p>
                    Poprawna odpowiedź:{' '}
                    <span className="font-semibold">{gapExercise.word}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Sentence exercise */}
      {sentenceExercise && (
        <Card className="p-6 mb-6">
          <div className="mb-4">
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Układanie zdań
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Ułóż zdanie używając wszystkich podanych słów:
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full font-medium">
              {sentenceExercise.targetWord}
            </span>
            {sentenceExercise.contextWords.map((word, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
              >
                {word}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-400 mb-4 italic">
            Podpowiedź: {sentenceExercise.hint}
          </p>

          <textarea
            value={sentenceAnswer}
            onChange={(e) => setSentenceAnswer(e.target.value)}
            placeholder="Wpisz swoje zdanie..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={3}
            disabled={!!sentenceResult}
          />

          {!sentenceResult && (
            <div className="mt-4">
              <Button onClick={checkSentenceAnswer} loading={checkingSentence}>
                Sprawdź
              </Button>
            </div>
          )}

          {sentenceResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                sentenceResult.correct
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              }`}
            >
              <p className="font-semibold mb-2">{sentenceResult.feedback}</p>
              {sentenceResult.correctedSentence && (
                <p>
                  Przykładowe poprawne zdanie:{' '}
                  <span className="font-medium italic">
                    {sentenceResult.correctedSentence}
                  </span>
                </p>
              )}
              <p className="mt-2 text-sm opacity-75">
                Przykład: {sentenceExercise.exampleSentence}
              </p>
            </div>
          )}
        </Card>
      )}

      {!selectedSetId && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Wybierz zestaw
          </h3>
          <p className="text-gray-500">
            Wybierz zestaw fiszek, aby rozpocząć ćwiczenia.
          </p>
        </Card>
      )}

      {selectedSetId && flashcards.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">
            Ten zestaw nie ma jeszcze fiszek. Dodaj fiszki, aby móc ćwiczyć.
          </p>
        </Card>
      )}
    </div>
  )
}
