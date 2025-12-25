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
  flashcardId: string
  sentence: string
  word: string
  hint: string
  answer: string
  checked: boolean
  correct: boolean | null
}

interface SentenceExercise {
  flashcardId: string
  targetWord: string
  translation: string
  contextWords: string[]
  exampleSentence: string
  hint: string
  answer: string
  checked: boolean
  correct: boolean | null
  feedback: string
}

type ExerciseType = 'gap' | 'sentence'

// Loading messages for AI generation
const loadingMessages = [
  'AI tworzy ćwiczenia dla Ciebie...',
  'Generujemy spersonalizowane zadania...',
  'Przygotowujemy materiały do nauki...',
  'AI analizuje słownictwo...',
  'Tworzymy kontekstowe ćwiczenia...',
]

function LoadingSpinner({ message }: { message: string }) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <div className="w-16 h-16 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <p className="text-lg text-gray-600 font-medium">{message}{dots}</p>
      <p className="text-sm text-gray-400 mt-2">To może potrwać kilka sekund</p>
    </div>
  )
}

export default function ExercisesPage() {
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)

  const [exerciseType, setExerciseType] = useState<ExerciseType>('gap')
  const [generating, setGenerating] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0])

  // Gap exercises state
  const [gapExercises, setGapExercises] = useState<GapExercise[]>([])

  // Sentence exercises state
  const [sentenceExercises, setSentenceExercises] = useState<SentenceExercise[]>([])
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [checkingSentence, setCheckingSentence] = useState(false)

  useEffect(() => {
    fetchSets()
  }, [])

  useEffect(() => {
    if (selectedSetId) {
      fetchFlashcards()
      // Reset exercises when changing set
      setGapExercises([])
      setSentenceExercises([])
      setCurrentSentenceIndex(0)
    }
  }, [selectedSetId])

  // Rotate loading messages
  useEffect(() => {
    if (generating) {
      const interval = setInterval(() => {
        setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)])
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [generating])

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

  // Generate all gap exercises at once
  const generateGapExercises = async () => {
    if (flashcards.length === 0) return

    setGenerating(true)
    setGapExercises([])

    const set = sets.find((s) => s.id === selectedSetId)
    const exercises: GapExercise[] = []

    try {
      // Generate exercises for all flashcards
      for (const flashcard of flashcards) {
        try {
          const response = await fetch('/api/exercises/gap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: flashcard.word,
              translation: flashcard.translation,
              language: set?.language,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            exercises.push({
              flashcardId: flashcard.id,
              sentence: data.sentence,
              word: data.word,
              hint: data.hint,
              answer: '',
              checked: false,
              correct: null,
            })
          }
        } catch {
          // Continue with other flashcards if one fails
        }
      }

      setGapExercises(exercises)
    } catch (error) {
      console.error('Failed to generate exercises:', error)
      alert('Wystąpił błąd podczas generowania ćwiczeń')
    } finally {
      setGenerating(false)
    }
  }

  // Generate sentence exercises
  const generateSentenceExercises = async () => {
    if (flashcards.length === 0) return

    setGenerating(true)
    setSentenceExercises([])
    setCurrentSentenceIndex(0)

    const set = sets.find((s) => s.id === selectedSetId)
    const exercises: SentenceExercise[] = []

    try {
      for (const flashcard of flashcards) {
        try {
          const response = await fetch('/api/exercises/sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: flashcard.word,
              translation: flashcard.translation,
              language: set?.language,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            exercises.push({
              flashcardId: flashcard.id,
              targetWord: data.targetWord,
              translation: flashcard.translation,
              contextWords: data.contextWords,
              exampleSentence: data.exampleSentence,
              hint: data.hint,
              answer: '',
              checked: false,
              correct: null,
              feedback: '',
            })
          }
        } catch {
          // Continue with other flashcards if one fails
        }
      }

      setSentenceExercises(exercises)
    } catch (error) {
      console.error('Failed to generate exercises:', error)
      alert('Wystąpił błąd podczas generowania ćwiczeń')
    } finally {
      setGenerating(false)
    }
  }

  const startExercises = () => {
    if (exerciseType === 'gap') {
      generateGapExercises()
    } else {
      generateSentenceExercises()
    }
  }

  const resetExercises = () => {
    if (exerciseType === 'gap') {
      setGapExercises(prev => prev.map(ex => ({
        ...ex,
        answer: '',
        checked: false,
        correct: null,
      })))
    } else {
      setSentenceExercises(prev => prev.map(ex => ({
        ...ex,
        answer: '',
        checked: false,
        correct: null,
        feedback: '',
      })))
      setCurrentSentenceIndex(0)
    }
  }

  // Gap exercises handlers
  const updateGapAnswer = (index: number, value: string) => {
    setGapExercises(prev => prev.map((ex, i) =>
      i === index ? { ...ex, answer: value } : ex
    ))
  }

  const checkGapAnswer = (index: number) => {
    setGapExercises(prev => prev.map((ex, i) => {
      if (i !== index) return ex
      const correct = ex.answer.trim().toLowerCase() === ex.word.toLowerCase()
      return { ...ex, checked: true, correct }
    }))
  }

  const checkAllGaps = () => {
    setGapExercises(prev => prev.map(ex => {
      const correct = ex.answer.trim().toLowerCase() === ex.word.toLowerCase()
      return { ...ex, checked: true, correct }
    }))
  }

  // Sentence exercises handlers
  const checkSentenceAnswer = async () => {
    const exercise = sentenceExercises[currentSentenceIndex]
    if (!exercise || !exercise.answer.trim()) return

    const set = sets.find((s) => s.id === selectedSetId)

    setCheckingSentence(true)
    try {
      const response = await fetch('/api/exercises/sentence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: exercise.answer,
          targetWord: exercise.targetWord,
          contextWords: exercise.contextWords,
          language: set?.language,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSentenceExercises(prev => prev.map((ex, i) =>
          i === currentSentenceIndex
            ? { ...ex, checked: true, correct: data.correct, feedback: data.feedback }
            : ex
        ))
      }
    } catch (error) {
      console.error('Failed to check sentence:', error)
    } finally {
      setCheckingSentence(false)
    }
  }

  const nextSentence = () => {
    if (currentSentenceIndex < sentenceExercises.length - 1) {
      setCurrentSentenceIndex(prev => prev + 1)
    }
  }

  const prevSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(prev => prev - 1)
    }
  }

  // Calculate progress
  const gapProgress = gapExercises.length > 0
    ? gapExercises.filter(ex => ex.checked).length
    : 0
  const gapCorrect = gapExercises.filter(ex => ex.correct === true).length

  const sentenceProgress = sentenceExercises.length > 0
    ? sentenceExercises.filter(ex => ex.checked).length
    : 0
  const sentenceCorrect = sentenceExercises.filter(ex => ex.correct === true).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
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
            onChange={(e) => {
              setExerciseType(e.target.value as ExerciseType)
              setGapExercises([])
              setSentenceExercises([])
            }}
            options={[
              { value: 'gap', label: 'Uzupełnianie luk' },
              { value: 'sentence', label: 'Układanie zdań' },
            ]}
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={startExercises}
            disabled={!selectedSetId || generating}
          >
            {(gapExercises.length > 0 || sentenceExercises.length > 0)
              ? 'Generuj nowe ćwiczenia'
              : 'Rozpocznij ćwiczenia'}
          </Button>

          {(gapExercises.length > 0 || sentenceExercises.length > 0) && (
            <Button variant="secondary" onClick={resetExercises}>
              Resetuj odpowiedzi
            </Button>
          )}
        </div>
      </Card>

      {/* Loading state */}
      {generating && (
        <Card className="p-6 mb-6">
          <LoadingSpinner message={loadingMessage} />
        </Card>
      )}

      {/* Gap exercises - all at once */}
      {!generating && gapExercises.length > 0 && (
        <div className="space-y-4">
          {/* Progress bar */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Postęp: {gapProgress} / {gapExercises.length}
              </span>
              <span className="text-sm text-gray-500">
                Poprawne: <span className="text-green-600 font-medium">{gapCorrect}</span>
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-primary-600 rounded-full transition-all"
                style={{ width: `${(gapProgress / gapExercises.length) * 100}%` }}
              />
            </div>
          </Card>

          {/* Check all button */}
          {gapExercises.some(ex => !ex.checked && ex.answer.trim()) && (
            <Button onClick={checkAllGaps} className="w-full">
              Sprawdź wszystkie odpowiedzi
            </Button>
          )}

          {/* All gap exercises */}
          {gapExercises.map((exercise, index) => (
            <Card key={exercise.flashcardId} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {index + 1}. Uzupełnij lukę
                </span>
                {exercise.checked && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    exercise.correct
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {exercise.correct ? '✓ Poprawnie' : '✗ Błędnie'}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-3">
                Słowo: <span className="font-medium">{flashcards.find(f => f.id === exercise.flashcardId)?.translation}</span>
              </p>

              <p className="text-lg text-gray-700 mb-2">
                {exercise.sentence.split('_____')[0]}
                <input
                  type="text"
                  value={exercise.answer}
                  onChange={(e) => updateGapAnswer(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !exercise.checked) {
                      checkGapAnswer(index)
                    }
                  }}
                  disabled={exercise.checked}
                  className={`inline-block w-32 mx-1 px-2 py-1 border-b-2 text-center bg-transparent focus:outline-none ${
                    exercise.checked
                      ? exercise.correct
                        ? 'border-green-500 text-green-700'
                        : 'border-red-500 text-red-700'
                      : 'border-gray-300 focus:border-primary-500'
                  }`}
                />
                {exercise.sentence.split('_____')[1]}
              </p>

              <p className="text-xs text-gray-400 italic mb-3">
                Podpowiedź: {exercise.hint}
              </p>

              {!exercise.checked && (
                <Button size="sm" onClick={() => checkGapAnswer(index)}>
                  Sprawdź
                </Button>
              )}

              {exercise.checked && !exercise.correct && (
                <p className="text-sm text-red-600">
                  Poprawna odpowiedź: <span className="font-semibold">{exercise.word}</span>
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Sentence exercises - one at a time with progress */}
      {!generating && sentenceExercises.length > 0 && (
        <div className="space-y-4">
          {/* Progress bar */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Postęp: {sentenceProgress} / {sentenceExercises.length} słów
              </span>
              <span className="text-sm text-gray-500">
                Poprawne: <span className="text-green-600 font-medium">{sentenceCorrect}</span>
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full mb-3">
              <div
                className="h-2 bg-primary-600 rounded-full transition-all"
                style={{ width: `${(sentenceProgress / sentenceExercises.length) * 100}%` }}
              />
            </div>

            {/* Word progress indicators */}
            <div className="flex flex-wrap gap-2">
              {sentenceExercises.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSentenceIndex(i)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    i === currentSentenceIndex
                      ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                      : ex.checked
                        ? ex.correct
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </Card>

          {/* Current sentence exercise */}
          {sentenceExercises[currentSentenceIndex] && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  Słowo {currentSentenceIndex + 1} z {sentenceExercises.length}
                </span>
                {sentenceExercises[currentSentenceIndex].checked && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    sentenceExercises[currentSentenceIndex].correct
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {sentenceExercises[currentSentenceIndex].correct ? '✓ Poprawnie' : '○ Do poprawy'}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Ułóż zdanie używając wszystkich podanych słów:
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full font-medium">
                  {sentenceExercises[currentSentenceIndex].targetWord}
                </span>
                <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-sm">
                  ({sentenceExercises[currentSentenceIndex].translation})
                </span>
                {sentenceExercises[currentSentenceIndex].contextWords.map((word, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                    {word}
                  </span>
                ))}
              </div>

              <p className="text-sm text-gray-400 mb-4 italic">
                Podpowiedź: {sentenceExercises[currentSentenceIndex].hint}
              </p>

              <textarea
                value={sentenceExercises[currentSentenceIndex].answer}
                onChange={(e) => {
                  const value = e.target.value
                  setSentenceExercises(prev => prev.map((ex, i) =>
                    i === currentSentenceIndex ? { ...ex, answer: value } : ex
                  ))
                }}
                placeholder="Wpisz swoje zdanie..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                rows={3}
                disabled={sentenceExercises[currentSentenceIndex].checked}
              />

              {sentenceExercises[currentSentenceIndex].checked && sentenceExercises[currentSentenceIndex].feedback && (
                <div className={`p-4 rounded-lg mb-4 ${
                  sentenceExercises[currentSentenceIndex].correct
                    ? 'bg-green-50 text-green-700'
                    : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <p className="font-medium mb-1">{sentenceExercises[currentSentenceIndex].feedback}</p>
                  <p className="text-sm opacity-75">
                    Przykład: {sentenceExercises[currentSentenceIndex].exampleSentence}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={prevSentence}
                    disabled={currentSentenceIndex === 0}
                  >
                    ← Poprzednie
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={nextSentence}
                    disabled={currentSentenceIndex === sentenceExercises.length - 1}
                  >
                    Następne →
                  </Button>
                </div>

                {!sentenceExercises[currentSentenceIndex].checked && (
                  <Button
                    onClick={checkSentenceAnswer}
                    loading={checkingSentence}
                    disabled={!sentenceExercises[currentSentenceIndex].answer.trim()}
                  >
                    Sprawdź
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Completion message */}
          {sentenceProgress === sentenceExercises.length && sentenceExercises.length > 0 && (
            <Card className="p-6 text-center bg-green-50">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Ukończono wszystkie zdania!
              </h3>
              <p className="text-green-700 mb-4">
                Poprawne: {sentenceCorrect} / {sentenceExercises.length}
              </p>
              <Button onClick={resetExercises}>
                Zacznij od nowa
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Empty states */}
      {!selectedSetId && !generating && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz zestaw</h3>
          <p className="text-gray-500">Wybierz zestaw fiszek, aby rozpocząć ćwiczenia.</p>
        </Card>
      )}

      {selectedSetId && flashcards.length === 0 && !generating && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">
            Ten zestaw nie ma jeszcze fiszek. Dodaj fiszki, aby móc ćwiczyć.
          </p>
        </Card>
      )}

      {selectedSetId && flashcards.length > 0 && gapExercises.length === 0 && sentenceExercises.length === 0 && !generating && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Gotowy do nauki!</h3>
          <p className="text-gray-500 mb-4">
            Masz {flashcards.length} fiszek w tym zestawie. Kliknij "Rozpocznij ćwiczenia" aby wygenerować zadania.
          </p>
        </Card>
      )}
    </div>
  )
}
