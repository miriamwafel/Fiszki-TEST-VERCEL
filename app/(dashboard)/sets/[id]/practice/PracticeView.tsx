'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'

interface PracticeStats {
  id: string
  correct: number
  incorrect: number
  mastered: boolean
}

interface Flashcard {
  id: string
  word: string
  translation: string
  context?: string | null
  partOfSpeech?: string | null
  stats: PracticeStats | null
}

interface FlashcardSet {
  id: string
  name: string
  language: string
}

interface PracticeViewProps {
  set: FlashcardSet
  flashcards: Flashcard[]
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function PracticeView({ set, flashcards: initialFlashcards }: PracticeViewProps) {
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const [incorrectQueue, setIncorrectQueue] = useState<Flashcard[]>([])
  const [correctionMode, setCorrectionMode] = useState(false)
  const [correctionDone, setCorrectionDone] = useState(false)

  useEffect(() => {
    // Initialize queue with shuffled flashcards, prioritizing non-mastered ones
    const notMastered = initialFlashcards.filter((f) => !f.stats?.mastered)
    const mastered = initialFlashcards.filter((f) => f.stats?.mastered)

    // If all are mastered, use all flashcards
    const toUse = notMastered.length > 0 ? notMastered : initialFlashcards

    setQueue(shuffleArray(toUse))
    setIncorrectQueue([])
    setCurrentIndex(0)
    setCompleted(false)
    setStats({ correct: 0, incorrect: 0 })

    if (mastered.length === initialFlashcards.length) {
      // Show message that all are mastered but still allow practice
    }
  }, [initialFlashcards])

  const currentCard = queue[currentIndex]

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!currentCard) return

    // Tryb korekcji - sprawdź czy wpisano poprawną odpowiedź
    if (correctionMode) {
      const normalizedAnswer = answer.trim().toLowerCase()
      const normalizedWord = currentCard.word.toLowerCase()
      if (normalizedAnswer === normalizedWord) {
        setCorrectionDone(true)
        setCorrectionMode(false)
      }
      return
    }

    if (showResult) return

    // Don't submit empty answers - prevents accidental submission on Enter
    if (!answer.trim()) return

    const normalizedAnswer = answer.trim().toLowerCase()
    const normalizedWord = currentCard.word.toLowerCase()

    const correct = normalizedAnswer === normalizedWord

    setIsCorrect(correct)
    setShowResult(true)
    setStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }))

    // Add incorrect answers to retry queue
    if (!correct) {
      setIncorrectQueue((prev) => [...prev, currentCard])
      // Włącz tryb korekcji - użytkownik musi wpisać poprawną odpowiedź
      setCorrectionMode(true)
      setAnswer('')
    }

    // Update stats in database
    try {
      await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId: currentCard.id,
          correct,
        }),
      })
    } catch (error) {
      console.error('Failed to update stats:', error)
    }
  }, [answer, currentCard, showResult, correctionMode])

  const handleNext = useCallback(() => {
    setShowResult(false)
    setAnswer('')
    setCorrectionMode(false)
    setCorrectionDone(false)

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else if (incorrectQueue.length > 0) {
      // Start round with incorrect answers
      setQueue(shuffleArray(incorrectQueue))
      setIncorrectQueue([])
      setCurrentIndex(0)
    } else {
      setCompleted(true)
    }
  }, [currentIndex, queue.length, incorrectQueue])

  const handleRestart = () => {
    setQueue(shuffleArray(initialFlashcards))
    setIncorrectQueue([])
    setCurrentIndex(0)
    setCompleted(false)
    setStats({ correct: 0, incorrect: 0 })
    setShowResult(false)
    setAnswer('')
    setCorrectionMode(false)
    setCorrectionDone(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Pozwól przejść dalej tylko gdy odpowiedź poprawna LUB poprawiono po błędzie
      if (e.key === 'Enter' && showResult && (isCorrect || correctionDone)) {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showResult, handleNext, isCorrect, correctionDone])

  if (completed) {
    const totalAnswers = stats.correct + stats.incorrect
    const percentage = totalAnswers > 0 ? Math.round((stats.correct / totalAnswers) * 100) : 0

    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ukończono powtórkę!
          </h1>
          <p className="text-gray-500 mb-6">{set.name}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{percentage}%</p>
              <p className="text-sm text-gray-500">Wynik</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.correct}</p>
              <p className="text-sm text-gray-500">Poprawne</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.incorrect}</p>
              <p className="text-sm text-gray-500">Błędne</p>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Link href={`/sets/${set.id}`}>
              <Button variant="secondary">Powrót do zestawu</Button>
            </Link>
            <Button onClick={handleRestart}>Powtórz jeszcze raz</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-gray-500">Ładowanie...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/sets/${set.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Powrót do zestawu
        </Link>
        <div className="text-sm text-gray-500">
          {currentIndex + 1} / {queue.length}
          {incorrectQueue.length > 0 && (
            <span className="ml-2 text-orange-500">
              (+{incorrectQueue.length} do powtórki)
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6">
        <div
          className="h-2 bg-primary-600 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      <Card className="p-8">
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 mb-2">Przetłumacz na:</p>
          <p className="text-3xl font-bold text-gray-900">
            {currentCard.translation}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={correctionMode ? "Wpisz poprawną odpowiedź..." : "Wpisz odpowiedź..."}
            disabled={showResult && !correctionMode}
            autoFocus
            className={`text-center text-lg ${
              showResult
                ? isCorrect || correctionDone
                  ? 'border-green-500 bg-green-50'
                  : correctionMode
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-red-500 bg-red-50'
                : ''
            }`}
          />

          {showResult && (
            <div className="mt-4 text-center">
              {isCorrect ? (
                <p className="text-green-600 font-semibold">Poprawnie!</p>
              ) : correctionDone ? (
                <div>
                  <p className="text-green-600 font-semibold">Dobrze! Teraz możesz przejść dalej</p>
                </div>
              ) : (
                <div>
                  <p className="text-red-600 font-semibold mb-1">Niepoprawnie</p>
                  <p className="text-gray-600 mb-3">
                    Poprawna odpowiedź:{' '}
                    <span className="font-semibold">{currentCard.word}</span>
                  </p>
                  <p className="text-sm text-gray-500 mb-2">Wpisz poprawną odpowiedź, aby przejść dalej:</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            {showResult ? (
              correctionMode ? (
                <Button type="submit">Sprawdź</Button>
              ) : (
                <Button onClick={handleNext}>
                  Dalej
                  <svg
                    className="w-5 h-5 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Button>
              )
            ) : (
              <Button type="submit">Sprawdź</Button>
            )}
          </div>
        </form>
      </Card>

      <div className="mt-4 flex justify-center gap-4 text-sm">
        <span className="text-green-600">
          Poprawne: {stats.correct}
        </span>
        <span className="text-red-600">
          Błędne: {stats.incorrect}
        </span>
      </div>
    </div>
  )
}
