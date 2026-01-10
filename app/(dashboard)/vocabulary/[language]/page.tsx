'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { toast } from 'sonner'
import { emitVocabularyUpdated, useVocabularyAutoRefresh } from '@/lib/hooks/useVocabularySync'

interface VocabularyWord {
  id: string
  word: string
  translation: string
  frequencyRank: number
  level: string | null
  partOfSpeech: string | null
  category: string | null
  example: string | null
  userStatus: 'unknown' | 'learning' | 'known'
  userSource: string | null
  sourceInfo: {
    setId: string
    setName: string
    flashcardWord: string
  } | null
}

interface Stats {
  total: number
  unknown: number
  learning: number
  known: number
}

const languageNames: Record<string, string> = {
  en: 'Angielski',
  de: 'Niemiecki',
  es: 'Hiszpański',
  fr: 'Francuski',
  it: 'Włoski',
}

const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
}

const levelColors: Record<string, string> = {
  A1: 'bg-emerald-100 text-emerald-700',
  A2: 'bg-emerald-200 text-emerald-800',
  B1: 'bg-blue-100 text-blue-700',
  B2: 'bg-blue-200 text-blue-800',
  C1: 'bg-purple-100 text-purple-700',
  C2: 'bg-purple-200 text-purple-800',
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  unknown: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  learning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  known: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
}

export default function VocabularyPage({ params }: { params: Promise<{ language: string }> }) {
  const { language } = use(params)
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unknown' | 'learning' | 'known'>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const lastFetchTimeRef = useRef<number>(0)

  const fetchVocabulary = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (levelFilter !== 'all') params.set('level', levelFilter)
      params.set('limit', '200')
      params.set('_t', Date.now().toString()) // Cache bust

      const response = await fetch(`/api/vocabulary/${language}?${params}`, {
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json()
        setVocabulary(data.vocabulary)
        setStats(data.stats)
        lastFetchTimeRef.current = Date.now()
      }
    } catch (error) {
      console.error('Failed to fetch vocabulary:', error)
      toast.error('Błąd ładowania słownictwa')
    } finally {
      setLoading(false)
    }
  }, [language, filter, levelFilter])

  useEffect(() => {
    fetchVocabulary()
  }, [fetchVocabulary])

  // Auto-refresh po zmianach z innych komponentów
  useVocabularyAutoRefresh(fetchVocabulary, lastFetchTimeRef)

  const updateStatus = async (vocabularyId: string, status: 'unknown' | 'learning' | 'known') => {
    if (savingIds.has(vocabularyId)) return

    setSavingIds(prev => new Set(prev).add(vocabularyId))

    try {
      const response = await fetch(`/api/vocabulary/${language}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId, status, source: 'manual' }),
      })

      if (response.ok) {
        setVocabulary(prev =>
          prev.map(v =>
            v.id === vocabularyId ? { ...v, userStatus: status } : v
          )
        )
        // Update stats
        if (stats) {
          const oldWord = vocabulary.find(v => v.id === vocabularyId)
          if (oldWord) {
            const newStats = { ...stats }
            // Decrease old status count
            if (oldWord.userStatus === 'unknown') newStats.unknown--
            else if (oldWord.userStatus === 'learning') newStats.learning--
            else if (oldWord.userStatus === 'known') newStats.known--
            // Increase new status count
            if (status === 'unknown') newStats.unknown++
            else if (status === 'learning') newStats.learning++
            else if (status === 'known') newStats.known++
            setStats(newStats)
          }
        }
        toast.success(
          status === 'known' ? 'Oznaczono jako znane!' :
          status === 'learning' ? 'Oznaczono jako w nauce' :
          'Oznaczono jako nieznane'
        )

        // Emituj event dla innych komponentów
        emitVocabularyUpdated({
          type: 'status_changed',
          vocabularyId,
          language,
          newStatus: status,
        })
      }
    } catch {
      toast.error('Błąd zapisywania')
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev)
        next.delete(vocabularyId)
        return next
      })
    }
  }

  const syncFlashcards = async () => {
    if (syncing) return

    setSyncing(true)
    toast.info('Synchronizuję fiszki z bazą słownictwa...')

    try {
      const response = await fetch(`/api/vocabulary/${language}/sync-flashcards`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Zsynchronizowano ${data.synced} słów!`)
        // Odśwież dane
        await fetchVocabulary()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Błąd synchronizacji')
      }
    } catch {
      toast.error('Błąd połączenia')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
        </div>
      </div>
    )
  }

  const langName = languageNames[language] || language
  const langFlag = languageFlags[language] || '🌍'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/vocabulary"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Powrót do wyboru języka
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-4xl">{langFlag}</span>
          Baza słownictwa - {langName}
        </h1>
        <p className="text-gray-600 mt-2">
          Przeglądaj najważniejsze słowa i śledź swój postęp
        </p>
        <button
          onClick={syncFlashcards}
          disabled={syncing}
          className="mt-3 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {syncing ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-300 rounded-full animate-spin border-t-primary-600" />
              Synchronizuję...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Synchronizuj z fiszkami
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Wszystkich słów</div>
          </Card>
          <Card className="p-4 text-center border-gray-300">
            <div className="text-3xl font-bold text-gray-600">{stats.unknown}</div>
            <div className="text-sm text-gray-500">Nieznanych</div>
          </Card>
          <Card className="p-4 text-center border-amber-300 bg-amber-50">
            <div className="text-3xl font-bold text-amber-700">{stats.learning}</div>
            <div className="text-sm text-amber-600">W nauce</div>
          </Card>
          <Card className="p-4 text-center border-green-300 bg-green-50">
            <div className="text-3xl font-bold text-green-700">{stats.known}</div>
            <div className="text-sm text-green-600">Znanych</div>
          </Card>
        </div>
      )}

      {/* Progress bar */}
      {stats && stats.total > 0 && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Postęp nauki</span>
            <span>{Math.round(((stats.known + stats.learning) / stats.total) * 100)}%</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${(stats.known / stats.total) * 100}%` }}
              />
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: `${(stats.learning / stats.total) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded" /> Znane
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-amber-400 rounded" /> W nauce
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-gray-200 rounded" /> Nieznane
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setFilter('unknown')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unknown'
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Nieznane
          </button>
          <button
            onClick={() => setFilter('learning')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'learning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            W nauce
          </button>
          <button
            onClick={() => setFilter('known')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'known'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Znane
          </button>
        </div>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white"
        >
          <option value="all">Wszystkie poziomy</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
      </div>

      {/* Vocabulary list */}
      {vocabulary.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">
            {stats?.total === 0
              ? 'Baza słownictwa dla tego języka nie została jeszcze wygenerowana.'
              : 'Brak słów pasujących do filtrów.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {vocabulary.map((word) => (
            <div
              key={word.id}
              className={`p-4 rounded-lg border transition-colors ${
                statusColors[word.userStatus].bg
              } ${statusColors[word.userStatus].border}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono">
                      #{word.frequencyRank}
                    </span>
                    <span className="font-semibold text-lg text-gray-900">
                      {word.word}
                    </span>
                    {word.level && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        levelColors[word.level] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {word.level}
                      </span>
                    )}
                    {word.partOfSpeech && (
                      <span className="text-xs text-gray-400 italic">
                        {word.partOfSpeech}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-700 mt-1">
                    {word.translation}
                  </div>
                  {word.example && (
                    <div className="text-sm text-gray-500 mt-2 italic">
                      "{word.example}"
                    </div>
                  )}
                  {word.userSource && (
                    <div className="text-xs text-gray-400 mt-1">
                      {word.userSource === 'flashcard' && word.sourceInfo ? (
                        <span>
                          Fiszka z zestawu:{' '}
                          <Link
                            href={`/sets/${word.sourceInfo.setId}`}
                            className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {word.sourceInfo.setName}
                          </Link>
                        </span>
                      ) : word.userSource === 'story' ? (
                        'Źródło: historia'
                      ) : (
                        'Oznaczone ręcznie'
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => updateStatus(word.id, 'unknown')}
                    disabled={savingIds.has(word.id) || word.userStatus === 'unknown'}
                    className={`p-2 rounded-lg transition-colors ${
                      word.userStatus === 'unknown'
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                    } disabled:opacity-50`}
                    title="Nie znam"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => updateStatus(word.id, 'learning')}
                    disabled={savingIds.has(word.id) || word.userStatus === 'learning'}
                    className={`p-2 rounded-lg transition-colors ${
                      word.userStatus === 'learning'
                        ? 'bg-amber-200 text-amber-700'
                        : 'bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600'
                    } disabled:opacity-50`}
                    title="Uczę się"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </button>
                  <button
                    onClick={() => updateStatus(word.id, 'known')}
                    disabled={savingIds.has(word.id) || word.userStatus === 'known'}
                    className={`p-2 rounded-lg transition-colors ${
                      word.userStatus === 'known'
                        ? 'bg-green-200 text-green-700'
                        : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                    } disabled:opacity-50`}
                    title="Znam"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
