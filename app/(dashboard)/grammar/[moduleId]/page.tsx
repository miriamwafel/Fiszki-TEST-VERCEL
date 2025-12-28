'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import ReactMarkdown from 'react-markdown'

interface ModuleData {
  module: {
    id: string
    title: string
    titlePl: string
    description: string
    descriptionPl: string
    order: number
    estimatedMinutes: number
  }
  grammar: {
    language: string
    languageName: string
  }
  level: {
    level: string
  }
  progress: {
    id: string
    started: boolean
    completed: boolean
    completedAt: string | null
    generatedContent: string | null
    exercisesDone: number
    exercisesCorrect: number
  } | null
  reviews: Array<{
    id: string
    scheduledDate: string
    dayOffset: number
    completed: boolean
  }>
}

interface Exercise {
  type: 'fill_gap' | 'transform' | 'choose' | 'correct' | 'translate'
  instruction: string
  sentence: string
  answer: string
  hint?: string
  explanation?: string
  options?: string[]
}

const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
}

const levelColors: Record<string, string> = {
  A1: 'bg-green-100 text-green-700',
  A2: 'bg-green-200 text-green-800',
  B1: 'bg-blue-100 text-blue-700',
  B2: 'bg-blue-200 text-blue-800',
  C1: 'bg-purple-100 text-purple-700',
  C2: 'bg-purple-200 text-purple-800',
}

export default function GrammarModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = use(params)
  const [moduleData, setModuleData] = useState<ModuleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingExercises, setGeneratingExercises] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showExercises, setShowExercises] = useState(false)
  const [currentExercise, setCurrentExercise] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [stats, setStats] = useState({ done: 0, correct: 0 })

  useEffect(() => {
    fetchModule()
  }, [moduleId])

  const fetchModule = async () => {
    try {
      const response = await fetch(`/api/grammar/${moduleId}`)
      if (response.ok) {
        const data = await response.json()
        setModuleData(data)
        if (data.progress) {
          setStats({
            done: data.progress.exercisesDone,
            correct: data.progress.exercisesCorrect,
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch module:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateContent = async () => {
    setGenerating(true)
    try {
      const response = await fetch(`/api/grammar/${moduleId}`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setModuleData(prev => prev ? {
          ...prev,
          progress: data.progress,
        } : null)
      }
    } catch (error) {
      console.error('Failed to generate content:', error)
    } finally {
      setGenerating(false)
    }
  }

  const generateExercises = async () => {
    setGeneratingExercises(true)
    try {
      const response = await fetch(`/api/grammar/${moduleId}/exercises`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setExercises(data.exercises || [])
        setShowExercises(true)
        setCurrentExercise(0)
        setUserAnswer('')
        setShowResult(false)
      }
    } catch (error) {
      console.error('Failed to generate exercises:', error)
    } finally {
      setGeneratingExercises(false)
    }
  }

  const markComplete = async () => {
    setCompleting(true)
    try {
      const response = await fetch(`/api/grammar/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      if (response.ok) {
        const data = await response.json()
        setModuleData(prev => prev ? {
          ...prev,
          progress: data.progress,
          reviews: data.reviews || [],
        } : null)
      }
    } catch (error) {
      console.error('Failed to mark complete:', error)
    } finally {
      setCompleting(false)
    }
  }

  const checkAnswer = () => {
    const exercise = exercises[currentExercise]
    const normalizedAnswer = userAnswer.trim().toLowerCase()
    const normalizedCorrect = exercise.answer.trim().toLowerCase()
    const correct = normalizedAnswer === normalizedCorrect

    setIsCorrect(correct)
    setShowResult(true)
    setStats(prev => ({
      done: prev.done + 1,
      correct: prev.correct + (correct ? 1 : 0),
    }))

    // Update stats in DB
    fetch(`/api/grammar/${moduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercisesDone: stats.done + 1,
        exercisesCorrect: stats.correct + (correct ? 1 : 0),
      }),
    })
  }

  const nextExercise = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1)
      setUserAnswer('')
      setShowResult(false)
    } else {
      setShowExercises(false)
      setExercises([])
    }
  }

  const selectOption = (option: string) => {
    setUserAnswer(option)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <p className="text-gray-500">Nie znaleziono modułu</p>
        <Link href="/grammar" className="text-primary-600 hover:underline mt-4 inline-block">
          Wróć do listy modułów
        </Link>
      </div>
    )
  }

  const { module, grammar, level, progress, reviews } = moduleData

  // Widok ćwiczeń
  if (showExercises && exercises.length > 0) {
    const exercise = exercises[currentExercise]

    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setShowExercises(false)
              setExercises([])
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Wróć do teorii
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {currentExercise + 1} / {exercises.length}
            </span>
            <span className="text-sm text-green-600">
              ✓ {stats.correct}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${((currentExercise + 1) / exercises.length) * 100}%` }}
          />
        </div>

        {/* Exercise card */}
        <Card className="p-6">
          <div className="mb-4">
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
              exercise.type === 'fill_gap' ? 'bg-blue-100 text-blue-700' :
              exercise.type === 'transform' ? 'bg-purple-100 text-purple-700' :
              exercise.type === 'choose' ? 'bg-green-100 text-green-700' :
              exercise.type === 'correct' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {exercise.type === 'fill_gap' ? 'Uzupełnij lukę' :
               exercise.type === 'transform' ? 'Przekształć' :
               exercise.type === 'choose' ? 'Wybierz' :
               exercise.type === 'correct' ? 'Popraw błąd' :
               'Przetłumacz'}
            </span>
          </div>

          <p className="text-gray-700 mb-2">{exercise.instruction}</p>

          <p className="text-xl font-medium text-gray-900 mb-6 p-4 bg-gray-50 rounded-lg">
            {exercise.sentence}
          </p>

          {exercise.hint && !showResult && (
            <p className="text-sm text-gray-500 mb-4">
              💡 Podpowiedź: {exercise.hint}
            </p>
          )}

          {/* Input or options */}
          {exercise.type === 'choose' && exercise.options ? (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {exercise.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => !showResult && selectOption(option)}
                  disabled={showResult}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    showResult
                      ? option === exercise.answer
                        ? 'border-green-500 bg-green-50'
                        : option === userAnswer
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200'
                      : userAnswer === option
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={showResult}
              placeholder="Wpisz odpowiedź..."
              className="w-full px-4 py-3 border rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showResult && userAnswer.trim()) {
                  checkAnswer()
                }
              }}
            />
          )}

          {/* Result */}
          {showResult && (
            <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <>
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium text-green-700">Poprawnie!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-medium text-red-700">Niepoprawnie</span>
                  </>
                )}
              </div>
              {!isCorrect && (
                <p className="text-gray-700">
                  Poprawna odpowiedź: <strong>{exercise.answer}</strong>
                </p>
              )}
              {exercise.explanation && (
                <p className="text-sm text-gray-600 mt-2">
                  {exercise.explanation}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            {!showResult ? (
              <Button
                onClick={checkAnswer}
                disabled={!userAnswer.trim()}
              >
                Sprawdź
              </Button>
            ) : (
              <Button onClick={nextExercise}>
                {currentExercise < exercises.length - 1 ? 'Następne' : 'Zakończ'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/grammar" className="hover:text-gray-700">
          Gramatyka
        </Link>
        <span>/</span>
        <span className="flex items-center gap-1">
          {languageFlags[grammar.language]} {grammar.languageName}
        </span>
        <span>/</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[level.level]}`}>
          {level.level}
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {module.titlePl}
        </h1>
        <p className="text-gray-600">
          {module.descriptionPl}
        </p>
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span>⏱️ ~{module.estimatedMinutes} min</span>
          {progress?.completed && (
            <span className="text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ukończone
            </span>
          )}
          {stats.done > 0 && (
            <span className="text-blue-600">
              Ćwiczenia: {stats.correct}/{stats.done} poprawnych
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {!progress?.generatedContent ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Rozpocznij naukę
          </h3>
          <p className="text-gray-500 mb-6">
            Kliknij przycisk poniżej, aby wygenerować materiał do nauki.
            AI przygotuje szczegółowe wyjaśnienie tematu z przykładami.
          </p>
          <Button onClick={generateContent} loading={generating}>
            {generating ? 'Generowanie...' : 'Wygeneruj materiał'}
          </Button>
        </Card>
      ) : (
        <>
          {/* Theory content */}
          <Card className="p-6 mb-6">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{progress.generatedContent}</ReactMarkdown>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={generateExercises}
                  loading={generatingExercises}
                  variant="secondary"
                >
                  {generatingExercises ? 'Generowanie...' : 'Ćwiczenia'}
                </Button>

                {!progress.completed && (
                  <Button
                    onClick={markComplete}
                    loading={completing}
                  >
                    Oznacz jako ukończone
                  </Button>
                )}
              </div>

              {progress.completed && reviews.length > 0 && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Powtórki:</span>
                  {reviews.filter(r => !r.completed).map((review, idx) => (
                    <span key={review.id} className="ml-2">
                      {idx > 0 && ', '}
                      +{review.dayOffset}d
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Reviews schedule */}
          {progress.completed && reviews.length > 0 && (
            <Card className="p-4 mt-4">
              <h3 className="font-medium text-gray-900 mb-3">Harmonogram powtórek</h3>
              <div className="space-y-2">
                {reviews.map((review) => {
                  const date = new Date(review.scheduledDate)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const reviewDate = new Date(date)
                  reviewDate.setHours(0, 0, 0, 0)
                  const isOverdue = reviewDate < today && !review.completed
                  const isToday = reviewDate.getTime() === today.getTime()

                  return (
                    <div
                      key={review.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        review.completed
                          ? 'bg-gray-50 text-gray-400'
                          : isOverdue
                          ? 'bg-red-50'
                          : isToday
                          ? 'bg-green-50'
                          : 'bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {review.completed ? (
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className={`w-5 h-5 rounded-full border-2 ${
                            isOverdue ? 'border-red-400' : isToday ? 'border-green-400' : 'border-blue-400'
                          }`} />
                        )}
                        <span className={`font-medium ${
                          review.completed ? 'line-through' : ''
                        }`}>
                          {date.toLocaleDateString('pl-PL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span className="text-xs text-gray-500">
                          (+{review.dayOffset} dni)
                        </span>
                      </div>
                      {isOverdue && !review.completed && (
                        <span className="text-xs text-red-600 font-medium">Zaległa!</span>
                      )}
                      {isToday && !review.completed && (
                        <span className="text-xs text-green-600 font-medium">Dzisiaj!</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
