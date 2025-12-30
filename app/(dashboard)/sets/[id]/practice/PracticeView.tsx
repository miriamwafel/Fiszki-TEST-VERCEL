'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

const BATCH_SIZE = 7 // Rozmiar partii jak w Quizlet

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize))
  }
  return batches
}

export function PracticeView({ set, flashcards: initialFlashcards }: PracticeViewProps) {
  // Partie słówek
  const [allBatches, setAllBatches] = useState<Flashcard[][]>([])
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0)

  // Aktualna runda w partii
  const [currentRound, setCurrentRound] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [masteredInBatch, setMasteredInBatch] = useState<Set<string>>(new Set())

  // Stan UI
  const [answer, setAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })

  // Tryb korekcji
  const [correctionMode, setCorrectionMode] = useState(false)
  const [correctionDone, setCorrectionDone] = useState(false)
  const [userAnswer, setUserAnswer] = useState('')

  // Inicjalizacja partii
  useEffect(() => {
    const notMastered = initialFlashcards.filter((f) => !f.stats?.mastered)
    const toUse = notMastered.length > 0 ? notMastered : initialFlashcards

    const shuffled = shuffleArray(toUse)
    const batches = splitIntoBatches(shuffled, BATCH_SIZE)

    setAllBatches(batches)
    setCurrentBatchIndex(0)
    setCurrentRound(batches[0] || [])
    setCurrentIndex(0)
    setMasteredInBatch(new Set())
    setCompleted(false)
    setStats({ correct: 0, incorrect: 0 })
  }, [initialFlashcards])

  const currentBatch = allBatches[currentBatchIndex] || []
  const currentCard = currentRound[currentIndex]
  const totalBatches = allBatches.length

  // Ile słówek opanowanych w aktualnej partii
  const batchProgress = useMemo(() => {
    return {
      total: currentBatch.length,
      mastered: masteredInBatch.size,
    }
  }, [currentBatch.length, masteredInBatch.size])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!currentCard) return

    // Tryb korekcji
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

    if (correct) {
      // Oznacz jako opanowane w tej partii
      setMasteredInBatch((prev) => new Set(prev).add(currentCard.id))
    } else {
      // Włącz tryb korekcji
      setCorrectionMode(true)
      setUserAnswer(answer)
      setAnswer('')
    }

    // Zapisz w bazie
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
    setUserAnswer('')

    if (currentIndex < currentRound.length - 1) {
      // Następne słówko w rundzie
      setCurrentIndex((prev) => prev + 1)
    } else {
      // Koniec rundy - sprawdź czy są słówka do powtórki w tej partii
      const notMasteredInBatch = currentBatch.filter(
        (card) => !masteredInBatch.has(card.id)
      )

      if (notMasteredInBatch.length > 0) {
        // Powtórz tylko nieopanowane słówka z tej partii
        setCurrentRound(shuffleArray(notMasteredInBatch))
        setCurrentIndex(0)
      } else if (currentBatchIndex < allBatches.length - 1) {
        // Przejdź do następnej partii
        const nextBatchIndex = currentBatchIndex + 1
        setCurrentBatchIndex(nextBatchIndex)
        setCurrentRound(allBatches[nextBatchIndex])
        setCurrentIndex(0)
        setMasteredInBatch(new Set())
      } else {
        // Koniec wszystkich partii
        setCompleted(true)
      }
    }
  }, [currentIndex, currentRound.length, currentBatch, masteredInBatch, currentBatchIndex, allBatches])

  const handleOverrideCorrect = useCallback(async () => {
    if (!currentCard) return

    setStats((prev) => ({
      correct: prev.correct + 1,
      incorrect: prev.incorrect - 1,
    }))

    // Oznacz jako opanowane
    setMasteredInBatch((prev) => new Set(prev).add(currentCard.id))

    setCorrectionMode(false)
    setCorrectionDone(true)
    setIsCorrect(true)

    try {
      await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId: currentCard.id,
          correct: true,
          override: true,
        }),
      })
    } catch (error) {
      console.error('Failed to override stats:', error)
    }
  }, [currentCard])

  const handleRestart = () => {
    const notMastered = initialFlashcards.filter((f) => !f.stats?.mastered)
    const toUse = notMastered.length > 0 ? notMastered : initialFlashcards

    const shuffled = shuffleArray(toUse)
    const batches = splitIntoBatches(shuffled, BATCH_SIZE)

    setAllBatches(batches)
    setCurrentBatchIndex(0)
    setCurrentRound(batches[0] || [])
    setCurrentIndex(0)
    setMasteredInBatch(new Set())
    setCompleted(false)
    setStats({ correct: 0, incorrect: 0 })
    setShowResult(false)
    setAnswer('')
    setCorrectionMode(false)
    setCorrectionDone(false)
    setUserAnswer('')
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const notMasteredCount = currentBatch.length - masteredInBatch.size

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/sets/${set.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Powrót do zestawu
        </Link>
        <div className="text-sm text-gray-500">
          Partia {currentBatchIndex + 1} / {totalBatches}
        </div>
      </div>

      {/* Postęp partii */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">
            Postęp partii: {batchProgress.mastered} / {batchProgress.total} opanowanych
          </span>
          <span className="text-gray-500">
            {currentIndex + 1} / {currentRound.length} w rundzie
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-green-500 rounded-full transition-all"
            style={{ width: `${(batchProgress.mastered / batchProgress.total) * 100}%` }}
          />
        </div>
        {notMasteredCount > 0 && notMasteredCount < currentBatch.length && (
          <p className="text-xs text-orange-600 mt-1">
            {notMasteredCount} {notMasteredCount === 1 ? 'słówko wraca' : 'słówek wraca'} do powtórki w tej partii
          </p>
        )}
      </div>

      {/* Progress bar rundy */}
      <div className="h-1.5 bg-gray-200 rounded-full mb-6">
        <div
          className="h-1.5 bg-primary-600 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / currentRound.length) * 100}%` }}
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
                  {userAnswer && (
                    <p className="text-gray-500 text-sm mb-2">
                      Twoja odpowiedź: <span className="font-medium">{userAnswer}</span>
                    </p>
                  )}
                  <p className="text-gray-600 mb-3">
                    Poprawna odpowiedź:{' '}
                    <span className="font-semibold">{currentCard.word}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleOverrideCorrect}
                    className="text-sm text-primary-600 hover:text-primary-700 hover:underline mb-3"
                  >
                    Moja odpowiedź była prawidłowa
                  </button>
                  <p className="text-sm text-gray-500 mb-2">lub wpisz poprawną odpowiedź, aby przejść dalej:</p>
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
