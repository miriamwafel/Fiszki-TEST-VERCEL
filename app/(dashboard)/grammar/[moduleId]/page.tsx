'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/Button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

const languageGradients: Record<string, string> = {
  en: 'from-blue-500 to-red-500',
  de: 'from-gray-800 to-yellow-500',
  es: 'from-red-500 to-yellow-500',
  fr: 'from-blue-500 to-red-400',
  it: 'from-green-500 to-red-500',
}

const levelBadges: Record<string, { bg: string; text: string; glow: string }> = {
  A1: { bg: 'bg-emerald-500', text: 'text-white', glow: 'shadow-emerald-500/30' },
  A2: { bg: 'bg-emerald-600', text: 'text-white', glow: 'shadow-emerald-600/30' },
  B1: { bg: 'bg-blue-500', text: 'text-white', glow: 'shadow-blue-500/30' },
  B2: { bg: 'bg-blue-600', text: 'text-white', glow: 'shadow-blue-600/30' },
  C1: { bg: 'bg-purple-500', text: 'text-white', glow: 'shadow-purple-500/30' },
  C2: { bg: 'bg-purple-600', text: 'text-white', glow: 'shadow-purple-600/30' },
}

const exerciseIcons: Record<string, string> = {
  fill_gap: '✏️',
  transform: '🔄',
  choose: '🎯',
  correct: '🔧',
  translate: '🌐',
}

const exerciseColors: Record<string, { bg: string; border: string; text: string }> = {
  fill_gap: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  transform: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  choose: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  correct: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  translate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
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
  const [sessionStats, setSessionStats] = useState({ done: 0, correct: 0 })

  // AI Explanation states
  const [aiExplanation, setAiExplanation] = useState('')
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [showAskInput, setShowAskInput] = useState(false)
  const [customQuestion, setCustomQuestion] = useState('')
  const [addingToTheory, setAddingToTheory] = useState(false)
  const [addedToTheory, setAddedToTheory] = useState(false)

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
        setSessionStats({ done: 0, correct: 0 })
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

    const newStats = {
      done: stats.done + 1,
      correct: stats.correct + (correct ? 1 : 0),
    }
    setStats(newStats)
    setSessionStats(prev => ({
      done: prev.done + 1,
      correct: prev.correct + (correct ? 1 : 0),
    }))

    fetch(`/api/grammar/${moduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercisesDone: newStats.done,
        exercisesCorrect: newStats.correct,
      }),
    })
  }

  const nextExercise = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1)
      setUserAnswer('')
      setShowResult(false)
      // Reset explanation state for next exercise
      setAiExplanation('')
      setShowAskInput(false)
      setCustomQuestion('')
      setAddedToTheory(false)
    } else {
      setShowExercises(false)
      setExercises([])
    }
  }

  const selectOption = (option: string) => {
    setUserAnswer(option)
  }

  const requestExplanation = async (question?: string) => {
    const exercise = exercises[currentExercise]
    setLoadingExplanation(true)
    setShowAskInput(false)

    try {
      const response = await fetch(`/api/grammar/${moduleId}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: exercise.sentence,
          answer: exercise.answer,
          userAnswer: userAnswer,
          exerciseType: exercise.type,
          question: question || customQuestion,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAiExplanation(data.explanation)
      }
    } catch (error) {
      console.error('Failed to get explanation:', error)
    } finally {
      setLoadingExplanation(false)
      setCustomQuestion('')
    }
  }

  const addExplanationToTheory = async () => {
    if (!aiExplanation) return

    setAddingToTheory(true)
    const exercise = exercises[currentExercise]

    try {
      const response = await fetch(`/api/grammar/${moduleId}/explain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          explanation: aiExplanation,
          context: `Ćwiczenie: "${exercise.sentence}" → ${exercise.answer}`,
        }),
      })

      if (response.ok) {
        setAddedToTheory(true)
      }
    } catch (error) {
      console.error('Failed to add to theory:', error)
    } finally {
      setAddingToTheory(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-gray-500">Ładowanie modułu...</p>
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">📚</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Nie znaleziono modułu</h2>
        <p className="text-gray-500 mb-6">Ten moduł może nie istnieć lub został usunięty.</p>
        <Link
          href="/grammar"
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Wróć do listy modułów
        </Link>
      </div>
    )
  }

  const { module, grammar, level, progress, reviews } = moduleData
  const levelStyle = levelBadges[level.level] || levelBadges.A1
  const gradient = languageGradients[grammar.language] || 'from-gray-500 to-gray-700'

  // Widok ćwiczeń
  if (showExercises && exercises.length > 0) {
    const exercise = exercises[currentExercise]
    const exColors = exerciseColors[exercise.type] || exerciseColors.fill_gap
    const progressPercent = ((currentExercise + (showResult ? 1 : 0)) / exercises.length) * 100

    return (
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              setShowExercises(false)
              setExercises([])
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Wróć do lekcji</span>
          </button>

          {/* Progress header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{exerciseIcons[exercise.type]}</span>
              <div>
                <h2 className="font-semibold text-gray-900">Ćwiczenie {currentExercise + 1} z {exercises.length}</h2>
                <p className="text-sm text-gray-500">{module.titlePl}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
                <div className="text-xs text-gray-500">poprawne</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{sessionStats.done - sessionStats.correct}</div>
                <div className="text-xs text-gray-500">błędne</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Exercise card */}
        <div className={`rounded-2xl border-2 ${exColors.border} ${exColors.bg} overflow-hidden shadow-lg`}>
          {/* Type badge */}
          <div className={`px-4 py-2 ${exColors.bg} border-b ${exColors.border}`}>
            <span className={`inline-flex items-center gap-2 text-sm font-medium ${exColors.text}`}>
              {exerciseIcons[exercise.type]}
              {exercise.type === 'fill_gap' ? 'Uzupełnij lukę' :
               exercise.type === 'transform' ? 'Przekształć zdanie' :
               exercise.type === 'choose' ? 'Wybierz poprawną odpowiedź' :
               exercise.type === 'correct' ? 'Znajdź i popraw błąd' :
               'Przetłumacz na język obcy'}
            </span>
          </div>

          <div className="p-6 bg-white">
            {/* Instruction */}
            <p className="text-gray-700 mb-4 text-lg">{exercise.instruction}</p>

            {/* Sentence */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5 mb-6 border border-gray-200">
              <p className="text-xl font-medium text-gray-900 leading-relaxed">
                {exercise.sentence}
              </p>
            </div>

            {/* Hint */}
            {exercise.hint && !showResult && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl mb-6 border border-amber-200">
                <span className="text-xl">💡</span>
                <p className="text-amber-800">{exercise.hint}</p>
              </div>
            )}

            {/* Input or options */}
            {exercise.type === 'choose' && exercise.options ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {exercise.options.map((option, idx) => {
                  const isSelected = userAnswer === option
                  const isAnswer = option === exercise.answer

                  let buttonClass = 'p-4 rounded-xl border-2 text-left transition-all font-medium '

                  if (showResult) {
                    if (isAnswer) {
                      buttonClass += 'border-green-500 bg-green-50 text-green-700'
                    } else if (isSelected) {
                      buttonClass += 'border-red-500 bg-red-50 text-red-700'
                    } else {
                      buttonClass += 'border-gray-200 bg-gray-50 text-gray-400'
                    }
                  } else {
                    if (isSelected) {
                      buttonClass += 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                    } else {
                      buttonClass += 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !showResult && selectOption(option)}
                      disabled={showResult}
                      className={buttonClass}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          showResult && isAnswer ? 'bg-green-500 text-white' :
                          showResult && isSelected ? 'bg-red-500 text-white' :
                          isSelected ? 'bg-primary-500 text-white' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mb-6">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={showResult}
                  placeholder="Wpisz swoją odpowiedź..."
                  className={`w-full px-5 py-4 text-lg border-2 rounded-xl transition-all focus:outline-none ${
                    showResult
                      ? isCorrect
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !showResult && userAnswer.trim()) {
                      checkAnswer()
                    }
                  }}
                  autoFocus
                />
              </div>
            )}

            {/* Result */}
            {showResult && (
              <div className={`rounded-xl p-5 mb-6 ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {isCorrect ? (
                    <>
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-bold text-green-700 text-lg">Świetnie!</span>
                        <p className="text-green-600 text-sm">Poprawna odpowiedź</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-bold text-red-700 text-lg">Nie tym razem</span>
                        <p className="text-red-600 text-sm">Spróbuj zapamiętać poprawną formę</p>
                      </div>
                    </>
                  )}
                </div>

                {!isCorrect && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                    <p className="text-gray-600 text-sm">Poprawna odpowiedź:</p>
                    <p className="text-gray-900 font-semibold text-lg">{exercise.answer}</p>
                  </div>
                )}

                {exercise.explanation && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-600 text-sm flex items-center gap-2">
                      <span>📖</span> Wyjaśnienie:
                    </p>
                    <p className="text-gray-700 mt-1">{exercise.explanation}</p>
                  </div>
                )}

                {/* AI Explanation Section */}
                {!aiExplanation && !loadingExplanation && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {!showAskInput ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => requestExplanation()}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all text-sm font-medium shadow-sm"
                        >
                          <span>🤖</span>
                          Wyjaśnij mi to
                        </button>
                        <button
                          onClick={() => setShowAskInput(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          <span>❓</span>
                          Mam pytanie
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          placeholder="Np. Dlaczego użyto tej formy?"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customQuestion.trim()) {
                              requestExplanation(customQuestion)
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => requestExplanation(customQuestion)}
                            disabled={!customQuestion.trim()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Zapytaj
                          </button>
                          <button
                            onClick={() => {
                              setShowAskInput(false)
                              setCustomQuestion('')
                            }}
                            className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loading Explanation */}
                {loadingExplanation && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 text-purple-600">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="font-medium">AI analizuje...</span>
                    </div>
                  </div>
                )}

                {/* AI Explanation Display */}
                {aiExplanation && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white/90">🤖</span>
                          <span className="font-semibold text-white text-sm">Wyjaśnienie AI</span>
                        </div>
                        <button
                          onClick={() => setAiExplanation('')}
                          className="text-white/70 hover:text-white transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 sm:p-5">
                        <div className="ai-explanation-content text-gray-700 text-sm sm:text-base leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiExplanation}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        {!addedToTheory ? (
                          <button
                            onClick={addExplanationToTheory}
                            disabled={addingToTheory}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {addingToTheory ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Zapisywanie...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Zapisz do notatek
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Zapisano!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="flex justify-end">
              {!showResult ? (
                <Button
                  onClick={checkAnswer}
                  disabled={!userAnswer.trim()}
                  className="px-8 py-3 text-lg"
                >
                  Sprawdź odpowiedź
                </Button>
              ) : (
                <Button
                  onClick={nextExercise}
                  className="px-8 py-3 text-lg"
                >
                  {currentExercise < exercises.length - 1 ? (
                    <span className="flex items-center gap-2">
                      Następne
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      🎉 Zakończ
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Session summary at the end */}
        {showResult && currentExercise === exercises.length - 1 && (
          <div className="mt-6 p-6 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl text-white text-center">
            <h3 className="text-xl font-bold mb-2">Koniec ćwiczeń!</h3>
            <p className="text-primary-100 mb-4">
              Twój wynik w tej sesji: {sessionStats.correct} / {sessionStats.done} ({Math.round((sessionStats.correct / sessionStats.done) * 100)}%)
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={generateExercises}
                className="px-6 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-colors"
              >
                🔄 Nowe ćwiczenia
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main view
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header with gradient */}
      <div className={`relative rounded-2xl bg-gradient-to-r ${gradient} p-6 mb-8 overflow-hidden`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-white/80 text-sm mb-4">
            <Link href="/grammar" className="hover:text-white transition-colors">
              Gramatyka
            </Link>
            <span>/</span>
            <span className="flex items-center gap-1">
              {languageFlags[grammar.language]} {grammar.languageName}
            </span>
            <span>/</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${levelStyle.bg} ${levelStyle.text}`}>
              {level.level}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {module.titlePl}
          </h1>
          <p className="text-white/80 text-lg">
            {module.descriptionPl}
          </p>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <span className="flex items-center gap-2 text-white/90 bg-white/20 px-3 py-1 rounded-full text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ~{module.estimatedMinutes} min
            </span>
            {progress?.completed && (
              <span className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Ukończone
              </span>
            )}
            {stats.done > 0 && (
              <span className="flex items-center gap-2 text-white/90 bg-white/20 px-3 py-1 rounded-full text-sm">
                📝 Ćwiczenia: {stats.correct}/{stats.done}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!progress?.generatedContent ? (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📚</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Rozpocznij naukę
          </h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Kliknij przycisk poniżej, aby AI wygenerowało dla Ciebie spersonalizowany materiał do nauki z przykładami i wyjaśnieniami.
          </p>
          <Button onClick={generateContent} loading={generating} className="px-8 py-3 text-lg">
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generowanie lekcji...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                ✨ Wygeneruj lekcję
              </span>
            )}
          </Button>

          {generating && (
            <p className="text-sm text-gray-400 mt-4">
              To może potrwać kilka sekund...
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Theory content */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 sm:p-8">
              <div className="grammar-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b-2 border-primary-200 flex items-center gap-3">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3 flex items-center gap-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-gray-700 leading-relaxed my-3">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-gray-900">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-4 space-y-2 list-none">
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-primary-500 mt-1">•</span>
                        <span>{children}</span>
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-primary-500 rounded-r-lg">
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children }) => {
                      const isBlock = className?.includes('language-')
                      if (isBlock) {
                        return (
                          <div className="my-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-5 overflow-x-auto shadow-lg">
                            <pre className="text-gray-100 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                              {children}
                            </pre>
                          </div>
                        )
                      }
                      return (
                        <code className="px-2 py-1 bg-primary-100 text-primary-700 rounded font-mono text-sm font-medium">
                          {children}
                        </code>
                      )
                    },
                    pre: ({ children }) => <>{children}</>,
                    table: ({ children }) => (
                      <div className="my-6 overflow-hidden rounded-xl border-2 border-gray-200 shadow-md">
                        <table className="w-full border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                        {children}
                      </thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left font-bold text-sm uppercase tracking-wide">
                        {children}
                      </th>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-gray-100">
                        {children}
                      </tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="hover:bg-gray-50 transition-colors even:bg-gray-50/50">
                        {children}
                      </tr>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-gray-700">
                        {children}
                      </td>
                    ),
                    hr: () => (
                      <hr className="my-8 border-t-2 border-gray-200" />
                    ),
                  }}
                >
                  {progress.generatedContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={generateExercises}
                  loading={generatingExercises}
                  variant="secondary"
                  className="px-6"
                >
                  {generatingExercises ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generowanie...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      🎯 Ćwicz gramatykę
                    </span>
                  )}
                </Button>

                {!progress.completed && (
                  <Button
                    onClick={markComplete}
                    loading={completing}
                  >
                    {completing ? 'Zapisywanie...' : '✅ Oznacz jako ukończone'}
                  </Button>
                )}
              </div>

              {progress.completed && reviews.length > 0 && (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span>📅</span>
                  <span className="font-medium">Powtórki zaplanowane</span>
                </div>
              )}
            </div>
          </div>

          {/* Reviews schedule */}
          {progress.completed && reviews.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">📅</span>
                Harmonogram powtórek
              </h3>
              <div className="grid gap-3">
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
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        review.completed
                          ? 'bg-gray-50 border border-gray-200'
                          : isOverdue
                          ? 'bg-red-50 border-2 border-red-200'
                          : isToday
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {review.completed ? (
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isOverdue ? 'bg-red-500 text-white' :
                            isToday ? 'bg-green-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            +{review.dayOffset}
                          </div>
                        )}
                        <div>
                          <span className={`font-semibold ${review.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {date.toLocaleDateString('pl-PL', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                          </span>
                          <p className="text-sm text-gray-500">
                            {review.dayOffset === 1 ? 'Jutro' : `Za ${review.dayOffset} dni od ukończenia`}
                          </p>
                        </div>
                      </div>
                      {isOverdue && !review.completed && (
                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                          ZALEGŁE
                        </span>
                      )}
                      {isToday && !review.completed && (
                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                          DZISIAJ
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
