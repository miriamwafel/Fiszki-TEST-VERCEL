'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Card } from '@/components/Card'
import { openAIChat } from '@/components/AIChatWidget'

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

const languageNames: Record<string, string> = {
  en: 'Angielski',
  de: 'Niemiecki',
  es: 'Hiszpański',
  fr: 'Francuski',
  it: 'Włoski',
  pt: 'Portugalski',
  ru: 'Rosyjski',
  ja: 'Japoński',
  ko: 'Koreański',
  zh: 'Chiński',
  nl: 'Holenderski',
  sv: 'Szwedzki',
  no: 'Norweski',
  da: 'Duński',
  fi: 'Fiński',
  cs: 'Czeski',
  uk: 'Ukraiński',
}

const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
  pt: '🇵🇹',
  ru: '🇷🇺',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  nl: '🇳🇱',
  sv: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  fi: '🇫🇮',
  cs: '🇨🇿',
  uk: '🇺🇦',
}

// Loading messages for AI generation
const loadingMessages = [
  'AI tworzy ćwiczenia dla Ciebie...',
  'Generujemy spersonalizowane zadania...',
  'Przygotowujemy materiały do nauki...',
  'AI analizuje słownictwo...',
  'Tworzymy kontekstowe ćwiczenia...',
]

function LoadingSpinner({ message, flashcardsCount = 10 }: { message: string, flashcardsCount?: number }) {
  const [dots, setDots] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    const baseTimeMs = flashcardsCount * 1.5 * 1000
    const startTime = Date.now()

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime

      setProgress(() => {
        if (elapsed < baseTimeMs) {
          const phase1Progress = (elapsed / baseTimeMs) * 90
          return Math.min(phase1Progress, 90)
        }

        const phase2Start = elapsed - baseTimeMs

        if (phase2Start < 10000) {
          return 90 + (phase2Start / 10000) * 9
        }

        if (phase2Start < 17000) {
          const phase3Elapsed = phase2Start - 10000
          return 99 + (phase3Elapsed / 7000) * 0.9
        }

        if (phase2Start < 20000) {
          const phase4Elapsed = phase2Start - 17000
          return 99.9 + (phase4Elapsed / 3000) * 0.09
        }

        return 99.99
      })
    }, 100)

    return () => {
      clearInterval(dotsInterval)
      clearInterval(progressInterval)
    }
  }, [flashcardsCount])

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
      <p className="text-lg text-gray-600 font-medium mb-4">{message}{dots}</p>
      <div className="w-80 bg-gray-200 rounded-full h-2.5 overflow-hidden mb-2">
        <div
          className="bg-primary-600 h-full transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mb-1">
        {progress < 99 ? Math.round(progress) : progress.toFixed(2)}%
      </p>
      <p className="text-sm text-gray-400">To może potrwać kilka sekund</p>
    </div>
  )
}

export default function ExercisesPage() {
  const searchParams = useSearchParams()
  const initialSetId = searchParams.get('setId') || ''

  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedSetId, setSelectedSetId] = useState(initialSetId)
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

  // Grupuj zestawy po językach
  const setsByLanguage: Record<string, FlashcardSet[]> = {}
  for (const set of sets) {
    if (!setsByLanguage[set.language]) {
      setsByLanguage[set.language] = []
    }
    setsByLanguage[set.language].push(set)
  }

  const availableLanguages = Object.keys(setsByLanguage).sort(
    (a, b) => setsByLanguage[b].length - setsByLanguage[a].length
  )

  const filteredSets = selectedLanguage ? setsByLanguage[selectedLanguage] || [] : []

  useEffect(() => {
    fetchSets()
  }, [])

  // Gdy zestawy się załadują i mamy initialSetId, ustaw język
  useEffect(() => {
    if (sets.length > 0 && initialSetId) {
      const set = sets.find(s => s.id === initialSetId)
      if (set) {
        setSelectedLanguage(set.language)
        setSelectedSetId(set.id)
      }
    }
  }, [sets, initialSetId])

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

  // Generate all gap exercises at once using batch API
  const generateGapExercises = async () => {
    if (flashcards.length === 0) return

    setGenerating(true)
    setGapExercises([])

    const set = sets.find((s) => s.id === selectedSetId)

    try {
      const response = await fetch('/api/exercises/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcards: flashcards.map(f => ({ id: f.id, word: f.word, translation: f.translation })),
          language: set?.language,
          type: 'gap',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const exercises: GapExercise[] = (data.exercises || []).map((ex: { flashcardId: string; sentence: string; word: string; hint: string }) => ({
          flashcardId: ex.flashcardId,
          sentence: ex.sentence,
          word: ex.word,
          hint: ex.hint,
          answer: '',
          checked: false,
          correct: null,
        }))
        setGapExercises(exercises)
      } else {
        throw new Error('Failed to generate exercises')
      }
    } catch (error) {
      console.error('Failed to generate exercises:', error)
      alert('Wystąpił błąd podczas generowania ćwiczeń')
    } finally {
      setGenerating(false)
    }
  }

  // Generate sentence exercises using batch API
  const generateSentenceExercises = async () => {
    if (flashcards.length === 0) return

    setGenerating(true)
    setSentenceExercises([])
    setCurrentSentenceIndex(0)

    const set = sets.find((s) => s.id === selectedSetId)

    try {
      const response = await fetch('/api/exercises/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcards: flashcards.map(f => ({ id: f.id, word: f.word, translation: f.translation })),
          language: set?.language,
          type: 'sentence',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const exercises: SentenceExercise[] = (data.exercises || []).map((ex: { flashcardId: string; targetWord: string; contextWords: string[]; exampleSentence: string; hint: string }, i: number) => ({
          flashcardId: ex.flashcardId,
          targetWord: ex.targetWord,
          translation: flashcards[i]?.translation || '',
          contextWords: ex.contextWords,
          exampleSentence: ex.exampleSentence,
          hint: ex.hint,
          answer: '',
          checked: false,
          correct: null,
          feedback: '',
        }))
        setSentenceExercises(exercises)
      } else {
        throw new Error('Failed to generate exercises')
      }
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
          Wybierz język, zestaw i typ ćwiczenia
        </h2>

        {/* Wybór języka */}
        {availableLanguages.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Język
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setSelectedLanguage(lang)
                    setSelectedSetId('')
                    setGapExercises([])
                    setSentenceExercises([])
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedLanguage === lang
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="text-xl">{languageFlags[lang] || '🌍'}</span>
                  <span className="font-medium">{languageNames[lang] || lang}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {setsByLanguage[lang].length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wybór zestawu - tylko po wybraniu języka */}
        {selectedLanguage && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Select
              id="set"
              label="Zestaw"
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              options={[
                { value: '', label: 'Wybierz zestaw...' },
                ...filteredSets.map((set) => ({
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
        )}

        {selectedLanguage && (
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
        )}
      </Card>

      {/* Loading state */}
      {generating && (
        <Card className="p-6 mb-6">
          <LoadingSpinner message={loadingMessage} flashcardsCount={flashcards.length} />
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

              <p className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                Słowo: <span className="font-medium">{flashcards.find(f => f.id === exercise.flashcardId)?.translation}</span>
                <button
                  onClick={() => {
                    const flashcard = flashcards.find(f => f.id === exercise.flashcardId)
                    if (flashcard) {
                      openAIChat(
                        `Wyjaśnij słówko "${exercise.word}" (${flashcard.translation}). Podaj przykłady użycia i kontekst.`,
                        {
                          word: exercise.word,
                          translation: flashcard.translation,
                          sentence: exercise.sentence.replace('_____', exercise.word),
                        }
                      )
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                  title="Zapytaj AI o to słówko"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI
                </button>
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
                <button
                  onClick={() => {
                    const ex = sentenceExercises[currentSentenceIndex]
                    openAIChat(
                      `Wyjaśnij słówko "${ex.targetWord}" (${ex.translation}). Jak użyć go w zdaniu?`,
                      {
                        word: ex.targetWord,
                        translation: ex.translation,
                        sentence: ex.exampleSentence,
                      }
                    )
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                  title="Zapytaj AI o to słówko"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI
                </button>
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
      {!selectedLanguage && !generating && availableLanguages.length > 0 && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz język</h3>
          <p className="text-gray-500">Wybierz język, aby zobaczyć dostępne zestawy do ćwiczeń.</p>
        </Card>
      )}

      {selectedLanguage && !selectedSetId && !generating && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz zestaw</h3>
          <p className="text-gray-500">
            Masz {filteredSets.length} {filteredSets.length === 1 ? 'zestaw' : filteredSets.length < 5 ? 'zestawy' : 'zestawów'} w języku {languageNames[selectedLanguage] || selectedLanguage}.
          </p>
        </Card>
      )}

      {availableLanguages.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak zestawów</h3>
          <p className="text-gray-500">Utwórz zestaw z fiszkami, aby móc ćwiczyć.</p>
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
