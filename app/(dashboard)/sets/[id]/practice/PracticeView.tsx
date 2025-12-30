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

const BATCH_SIZE = 7 // Ile słówek dokładamy na raz
const THRESHOLD = 2 // Gdy zostanie tyle lub mniej nieopanowanych, dokładamy nowe

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function PracticeView({ set, flashcards: initialFlashcards }: PracticeViewProps) {
  // Słówka czekające na dodanie
  const [waitingQueue, setWaitingQueue] = useState<Flashcard[]>([])

  // Aktywne słówka (w grze)
  const [activeCards, setActiveCards] = useState<Flashcard[]>([])
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set())

  // Aktualna runda
  const [currentRound, setCurrentRound] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

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

  // Inicjalizacja
  useEffect(() => {
    const notMastered = initialFlashcards.filter((f) => !f.stats?.mastered)
    const toUse = notMastered.length > 0 ? notMastered : initialFlashcards
    const shuffled = shuffleArray(toUse)

    // Weź pierwszą partię jako aktywne
    const firstBatch = shuffled.slice(0, BATCH_SIZE)
    const remaining = shuffled.slice(BATCH_SIZE)

    setActiveCards(firstBatch)
    setWaitingQueue(remaining)
    setCurrentRound(firstBatch)
    setCurrentIndex(0)
    setMasteredIds(new Set())
    setCompleted(false)
    setStats({ correct: 0, incorrect: 0 })
  }, [initialFlashcards])

  const currentCard = currentRound[currentIndex]

  // Statystyki
  const totalCards = initialFlashcards.filter((f) => !f.stats?.mastered).length || initialFlashcards.length
  const notMasteredCount = activeCards.filter(c => !masteredIds.has(c.id)).length

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
      setMasteredIds((prev) => new Set(prev).add(currentCard.id))
    } else {
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
      // Koniec rundy - sprawdź ile nieopanowanych zostało
      const notMasteredInActive = activeCards.filter(
        (card) => !masteredIds.has(card.id)
      )

      if (notMasteredInActive.length === 0 && waitingQueue.length === 0) {
        // Wszystko opanowane!
        setCompleted(true)
        return
      }

      // Czy dokładamy nowe słówka?
      if (notMasteredInActive.length <= THRESHOLD && waitingQueue.length > 0) {
        // Dokładamy nową partię
        const newBatch = waitingQueue.slice(0, BATCH_SIZE)
        const remainingQueue = waitingQueue.slice(BATCH_SIZE)

        const newActiveCards = [...activeCards, ...newBatch]
        setActiveCards(newActiveCards)
        setWaitingQueue(remainingQueue)

        // Nowa runda: nieopanowane + nowe słówka
        const nextRound = shuffleArray([...notMasteredInActive, ...newBatch])
        setCurrentRound(nextRound)
        setCurrentIndex(0)
      } else if (notMasteredInActive.length > 0) {
        // Powtarzamy tylko nieopanowane
        setCurrentRound(shuffleArray(notMasteredInActive))
        setCurrentIndex(0)
      } else {
        // Wszystko opanowane!
        setCompleted(true)
      }
    }
  }, [currentIndex, currentRound.length, activeCards, masteredIds, waitingQueue])

  const handleOverrideCorrect = useCallback(async () => {
    if (!currentCard) return

    setStats((prev) => ({
      correct: prev.correct + 1,
      incorrect: prev.incorrect - 1,
    }))

    setMasteredIds((prev) => new Set(prev).add(currentCard.id))

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

    const firstBatch = shuffled.slice(0, BATCH_SIZE)
    const remaining = shuffled.slice(BATCH_SIZE)

    setActiveCards(firstBatch)
    setWaitingQueue(remaining)
    setCurrentRound(firstBatch)
    setCurrentIndex(0)
    setMasteredIds(new Set())
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
          {currentIndex + 1} / {currentRound.length} w rundzie
        </div>
      </div>

      {/* Postęp ogólny */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">
            Opanowane: {masteredIds.size} / {totalCards}
          </span>
          {waitingQueue.length > 0 && (
            <span className="text-gray-500">
              +{waitingQueue.length} czeka
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-green-500 rounded-full transition-all"
            style={{ width: `${(masteredIds.size / totalCards) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-gray-500">
            W grze: {activeCards.length} słówek
          </span>
          {notMasteredCount > 0 && notMasteredCount <= THRESHOLD && waitingQueue.length > 0 && (
            <span className="text-blue-600">
              Zaraz dołożymy {Math.min(BATCH_SIZE, waitingQueue.length)} nowych!
            </span>
          )}
          {notMasteredCount > THRESHOLD && (
            <span className="text-orange-600">
              {notMasteredCount} do opanowania
            </span>
          )}
        </div>
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
