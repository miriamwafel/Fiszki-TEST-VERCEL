'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { toast } from 'sonner'

interface LanguageStats {
  language: string
  total: number
  unknown: number
  learning: number
  known: number
}

interface GenerationProgress {
  status: 'idle' | 'running' | 'complete' | 'error'
  currentLevel: string | null
  currentBatch: number
  totalCreated: number
  totalSkipped: number
  stillNeeded: number
  targetCount: number
  recentWords: string[]
  logs: string[]
  error?: string
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

const supportedLanguages = ['en', 'de', 'es', 'fr', 'it']

// Domyślne wartości CEFR
const DEFAULT_CEFR_TARGETS: Record<string, number> = {
  A1: 300,
  A2: 500,
  B1: 600,
  B2: 400,
  C1: 150,
  C2: 50,
}

const initialProgress: GenerationProgress = {
  status: 'idle',
  currentLevel: null,
  currentBatch: 0,
  totalCreated: 0,
  totalSkipped: 0,
  stillNeeded: 0,
  targetCount: 0,
  recentWords: [],
  logs: [],
}

export default function VocabularyIndexPage() {
  const [languages, setLanguages] = useState<LanguageStats[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingFull, setGeneratingFull] = useState<string | null>(null)
  const [cefrTargets, setCefrTargets] = useState<Record<string, number>>(DEFAULT_CEFR_TARGETS)
  const [editingCefr, setEditingCefr] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress>(initialProgress)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const fetchLanguages = async () => {
    try {
      const stats: LanguageStats[] = []

      for (const lang of supportedLanguages) {
        const response = await fetch(`/api/vocabulary/${lang}?limit=1&_t=${Date.now()}`, {
          cache: 'no-store',
        })

        if (response.ok) {
          const data = await response.json()
          stats.push({
            language: lang,
            total: data.stats?.total || 0,
            unknown: data.stats?.unknown || 0,
            learning: data.stats?.learning || 0,
            known: data.stats?.known || 0,
          })
        }
      }

      setLanguages(stats)
    } catch (error) {
      console.error('Failed to fetch languages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLanguages()

    // Sprawdź czy admin
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/users')
        setIsAdmin(res.ok)
      } catch {
        setIsAdmin(false)
      }
    }
    checkAdmin()

    // Załaduj zapisane targety CEFR z localStorage
    const savedTargets = localStorage.getItem('cefrTargets')
    if (savedTargets) {
      try {
        setCefrTargets(JSON.parse(savedTargets))
      } catch {
        // Ignoruj błędy parsowania
      }
    }
  }, [])

  // Zapisz targety do localStorage przy zmianie
  const saveCefrTargets = (targets: Record<string, number>) => {
    setCefrTargets(targets)
    localStorage.setItem('cefrTargets', JSON.stringify(targets))
  }

  const deleteVocabulary = async (language: string, level?: string) => {
    const confirmMsg = level
      ? `Usunąć wszystkie słowa ${level} dla ${languageNames[language]}?`
      : `Usunąć CAŁĄ bazę słów dla ${languageNames[language]}?`

    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(`/api/vocabulary/${language}/delete-all`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: level ? JSON.stringify({ level }) : undefined,
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Usunięto ${data.deleted} słów`)
        await fetchLanguages()
      } else {
        toast.error('Błąd usuwania')
      }
    } catch {
      toast.error('Błąd połączenia')
    }
  }

  const generateVocabulary = async (language: string, level: string) => {
    if (generating) return

    setGenerating(language)
    toast.info(`Generuję bazę słów ${languageNames[language]} (${level})...`, { duration: 10000 })

    try {
      const response = await fetch(`/api/vocabulary/${language}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, count: 200 }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Wygenerowano ${data.count} słów dla ${languageNames[language]}!`)
        // Odśwież listę
        await fetchLanguages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Błąd generowania')
      }
    } catch {
      toast.error('Błąd połączenia')
    } finally {
      setGenerating(null)
    }
  }

  const generateFullVocabulary = async (language: string) => {
    if (generatingFull) return

    setGeneratingFull(language)
    setProgress({ ...initialProgress, status: 'running', targetCount: Object.values(cefrTargets).reduce((a, b) => a + b, 0) })
    setShowProgressModal(true)

    const addLog = (msg: string) => {
      setProgress(prev => ({
        ...prev,
        logs: [...prev.logs.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]
      }))
    }

    try {
      addLog(`Rozpoczynam pełne generowanie ${languageNames[language]} (wszystkie poziomy)...`)

      const response = await fetch(`/api/vocabulary/${language}/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Błąd połączenia z serwerem')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Brak strumienia odpowiedzi')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            switch (data.type) {
              case 'start':
                addLog(data.message)
                break
              case 'info':
                addLog(data.message)
                break
              case 'level_start':
                setProgress(prev => ({
                  ...prev,
                  currentLevel: data.level,
                  stillNeeded: data.needed,
                }))
                addLog(`${data.level}: mam ${data.existing}/${data.target}, potrzebuję ${data.needed} nowych`)
                break
              case 'batch_start':
                setProgress(prev => ({ ...prev, currentBatch: data.batch }))
                addLog(`${data.level} batch ${data.batch}: proszę AI o ${data.requesting} słów...`)
                break
              case 'batch_complete':
                setProgress(prev => ({
                  ...prev,
                  totalCreated: data.totalCreated,
                  stillNeeded: data.stillNeeded,
                  recentWords: [...data.words, ...prev.recentWords].slice(0, 20),
                }))
                addLog(`${data.level} batch ${data.batch}: +${data.added} słów`)
                break
              case 'batch_error':
                addLog(`BŁĄD batch ${data.batch}: ${data.error}`)
                break
              case 'level_complete':
                addLog(`${data.level} GOTOWE: ${data.total}/${data.target} słów (+${data.created} nowych)`)
                break
              case 'complete':
                setProgress(prev => ({
                  ...prev,
                  status: 'complete',
                  totalCreated: data.totalCreated,
                  totalSkipped: data.totalSkipped,
                }))
                addLog(data.message)
                toast.success(`${languageNames[language]}: +${data.totalCreated} słów`)
                break
              case 'error':
                setProgress(prev => ({ ...prev, status: 'error', error: data.error }))
                addLog(`BŁĄD: ${data.error}`)
                toast.error(data.error)
                break
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      await fetchLanguages()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Nieznany błąd'
      setProgress(prev => ({ ...prev, status: 'error', error: errorMsg }))
      toast.error(errorMsg)
    } finally {
      setGeneratingFull(null)
    }
  }

  // Scroll logs to bottom when new log appears
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [progress.logs])

  const generateLevelVocabulary = async (language: string, level: string) => {
    if (generating || generatingFull) return

    const targetCount = cefrTargets[level] || 100

    setGenerating(`${language}-${level}`)
    setProgress({ ...initialProgress, status: 'running', targetCount })
    setShowProgressModal(true)

    const addLog = (msg: string) => {
      setProgress(prev => ({
        ...prev,
        logs: [...prev.logs.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]
      }))
    }

    try {
      addLog(`Rozpoczynam generowanie ${languageNames[language]} ${level}...`)

      const response = await fetch(`/api/vocabulary/${language}/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, targetCount }),
      })

      if (!response.ok) {
        throw new Error('Błąd połączenia z serwerem')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Brak strumienia odpowiedzi')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            switch (data.type) {
              case 'start':
                addLog(data.message)
                break
              case 'info':
                addLog(data.message)
                break
              case 'level_start':
                setProgress(prev => ({
                  ...prev,
                  currentLevel: data.level,
                  stillNeeded: data.needed,
                  targetCount: data.target,
                }))
                addLog(`${data.level}: mam ${data.existing}/${data.target}, potrzebuję ${data.needed} nowych`)
                break
              case 'batch_start':
                setProgress(prev => ({ ...prev, currentBatch: data.batch }))
                addLog(`${data.level} batch ${data.batch}: proszę AI o ${data.requesting} słów...`)
                break
              case 'batch_complete':
                setProgress(prev => ({
                  ...prev,
                  totalCreated: data.totalCreated,
                  stillNeeded: data.stillNeeded,
                  recentWords: [...data.words, ...prev.recentWords].slice(0, 20),
                }))
                addLog(`${data.level} batch ${data.batch}: +${data.added} słów (${data.words.slice(0, 5).join(', ')}${data.words.length > 5 ? '...' : ''})`)
                break
              case 'batch_error':
                addLog(`BŁĄD batch ${data.batch}: ${data.error}`)
                break
              case 'level_complete':
                addLog(`${data.level} GOTOWE: ${data.total}/${data.target} słów (+${data.created} nowych)`)
                break
              case 'complete':
                setProgress(prev => ({
                  ...prev,
                  status: 'complete',
                  totalCreated: data.totalCreated,
                  totalSkipped: data.totalSkipped,
                }))
                addLog(data.message)
                toast.success(`${languageNames[language]} ${level}: +${data.totalCreated} słów`)
                break
              case 'error':
                setProgress(prev => ({ ...prev, status: 'error', error: data.error }))
                addLog(`BŁĄD: ${data.error}`)
                toast.error(data.error)
                break
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      await fetchLanguages()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Nieznany błąd'
      setProgress(prev => ({ ...prev, status: 'error', error: errorMsg }))
      toast.error(errorMsg)
    } finally {
      setGenerating(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
        </div>
      </div>
    )
  }

  const languagesWithData = languages.filter(l => l.total > 0)
  const languagesEmpty = supportedLanguages.filter(
    lang => !languagesWithData.find(l => l.language === lang)
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Baza słownictwa</h1>
        <p className="text-gray-600 mt-2">
          Przeglądaj najważniejsze słowa dla każdego języka i śledź swój postęp w nauce
        </p>
      </div>

      {/* Panel admina - generowanie bazy */}
      {isAdmin && (
        <Card className="p-6 mb-8 border-purple-200 bg-purple-50">
          <h2 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
            <span>⚙️</span> Panel admina - Wygeneruj bazę słownictwa
          </h2>

          {/* Edytowalne targety CEFR */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200 text-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-purple-900">
                Docelowa liczba słów per poziom (suma: {Object.values(cefrTargets).reduce((a, b) => a + b, 0)}):
              </p>
              <div className="flex gap-2">
                {editingCefr ? (
                  <>
                    <button
                      onClick={() => {
                        saveCefrTargets(DEFAULT_CEFR_TARGETS)
                        setEditingCefr(false)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setEditingCefr(false)}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Zapisz
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingCefr(true)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    ✏️ Edytuj
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1 text-center text-xs">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
                const bgColors: Record<string, string> = {
                  A1: 'bg-green-100',
                  A2: 'bg-green-200',
                  B1: 'bg-yellow-100',
                  B2: 'bg-yellow-200',
                  C1: 'bg-orange-100',
                  C2: 'bg-orange-200',
                }
                return (
                  <div key={level} className={`${bgColors[level]} p-1 rounded`}>
                    <span className="font-bold">{level}</span>
                    <br />
                    {editingCefr ? (
                      <input
                        type="number"
                        value={cefrTargets[level]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          saveCefrTargets({ ...cefrTargets, [level]: val })
                        }}
                        className="w-full text-center bg-white/50 rounded border border-gray-300 text-xs p-0.5"
                        min={0}
                        max={2000}
                      />
                    ) : (
                      <span>{cefrTargets[level]}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Kliknij poziom poniżej aby uzupełnić brakujące słowa do podanej liczby
            </p>
          </div>

          {/* Generowanie pełnej bazy */}
          <div className="mb-6">
            <h3 className="font-semibold text-purple-800 mb-2">Generuj pełną bazę (wszystkie poziomy)</h3>
            <p className="text-sm text-purple-700 mb-3">
              Wygeneruje brakujące słowa dla wszystkich poziomów. Może trwać kilka minut.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {supportedLanguages.map(lang => {
                const langWordCount = languages.find(l => l.language === lang)?.total || 0
                return (
                <div key={`full-${lang}`} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-purple-300">
                  <span className="text-2xl">{languageFlags[lang]}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{languageNames[lang]}</div>
                    <div className="text-xs text-gray-500">
                      {langWordCount} słów
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {langWordCount > 0 && (
                      <button
                        onClick={() => deleteVocabulary(lang)}
                        disabled={generatingFull !== null || generating !== null}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                        title="Usuń bazę"
                      >
                        🗑️
                      </button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => generateFullVocabulary(lang)}
                      disabled={generatingFull !== null || generating !== null}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {generatingFull === lang ? (
                        <span className="flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-white/30 rounded-full animate-spin border-t-white" />
                          Generuję...
                        </span>
                      ) : (
                        'Pełna baza'
                      )}
                    </Button>
                  </div>
                </div>
              )
              })}
            </div>
          </div>

          {/* Generowanie poziom po poziomie */}
          <div className="pt-4 border-t border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-2">Generowanie poziom po poziomie</h3>
            <p className="text-sm text-purple-700 mb-3">
              Szybsza opcja - generuj jeden poziom na raz (polecane dla stabilności).
            </p>
            <div className="space-y-3">
              {supportedLanguages.map(lang => (
                <div key={`level-${lang}`} className="bg-white rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{languageFlags[lang]}</span>
                    <span className="font-medium text-gray-900">{languageNames[lang]}</span>
                    <span className="text-xs text-gray-500">({languages.find(l => l.language === lang)?.total || 0} słów)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => (
                      <Button
                        key={level}
                        size="sm"
                        variant="secondary"
                        onClick={() => generateLevelVocabulary(lang, level)}
                        disabled={generating !== null || generatingFull !== null}
                        className="text-xs px-2 py-1"
                      >
                        {generating === `${lang}-${level}` ? (
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 border-2 border-gray-400 rounded-full animate-spin border-t-gray-600" />
                          </span>
                        ) : (
                          level
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {languagesWithData.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Baza słownictwa jest pusta
          </h2>
          <p className="text-gray-600">
            {isAdmin
              ? 'Użyj panelu powyżej aby wygenerować bazę słów.'
              : 'Administrator musi najpierw wygenerować bazę słów dla poszczególnych języków.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {languagesWithData.map((lang) => {
            const langProgress = lang.total > 0
              ? Math.round(((lang.known + lang.learning) / lang.total) * 100)
              : 0

            return (
              <Link key={lang.language} href={`/vocabulary/${lang.language}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-5xl">
                      {languageFlags[lang.language] || '🌍'}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {languageNames[lang.language] || lang.language}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {lang.total} słów w bazie
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Postęp</span>
                      <span>{langProgress}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-green-500 transition-all duration-500"
                          style={{ width: `${(lang.known / lang.total) * 100}%` }}
                        />
                        <div
                          className="bg-amber-400 transition-all duration-500"
                          style={{ width: `${(lang.learning / lang.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-gray-50 rounded px-2 py-1">
                      <div className="font-semibold text-gray-600">{lang.unknown}</div>
                      <div className="text-gray-400 text-xs">nieznane</div>
                    </div>
                    <div className="bg-amber-50 rounded px-2 py-1">
                      <div className="font-semibold text-amber-700">{lang.learning}</div>
                      <div className="text-amber-500 text-xs">w nauce</div>
                    </div>
                    <div className="bg-green-50 rounded px-2 py-1">
                      <div className="font-semibold text-green-700">{lang.known}</div>
                      <div className="text-green-500 text-xs">znane</div>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Info section */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Jak to działa?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Każdy język ma bazę najważniejszych słów uporządkowanych według poziomów (A1 → A2 → B1 → B2 → C1 → C2)</li>
          <li>• Oznaczaj słowa jako "znane", "w nauce" lub "nieznane"</li>
          <li>• Gdy dodajesz fiszki, odpowiadające słowa są automatycznie oznaczane jako "w nauce"</li>
          <li>• <strong>Historyjki AI automatycznie wybierają słowa</strong> - najpierw podstawowe (A1), potem trudniejsze</li>
          <li>• Nie musisz wybierać poziomu słów - system sam wie jakie słowa powinieneś znać!</li>
        </ul>
      </div>

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {progress.status === 'running' && (
                  <div className="w-5 h-5 border-3 border-purple-200 rounded-full animate-spin border-t-purple-600" />
                )}
                {progress.status === 'complete' && <span className="text-green-500">✓</span>}
                {progress.status === 'error' && <span className="text-red-500">✕</span>}
                Generowanie słownictwa
              </h2>
              {progress.status !== 'running' && (
                <button
                  onClick={() => {
                    setShowProgressModal(false)
                    setProgress(initialProgress)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="p-4 bg-gray-50 border-b">
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div className="bg-white rounded-lg p-2 border">
                  <div className="text-2xl font-bold text-purple-600">{progress.totalCreated}</div>
                  <div className="text-gray-500 text-xs">dodano</div>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <div className="text-2xl font-bold text-gray-600">{progress.stillNeeded}</div>
                  <div className="text-gray-500 text-xs">pozostało</div>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <div className="text-2xl font-bold text-amber-600">{progress.totalSkipped}</div>
                  <div className="text-gray-500 text-xs">pominięto</div>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <div className="text-lg font-bold text-blue-600">{progress.currentLevel || '-'}</div>
                  <div className="text-gray-500 text-xs">poziom</div>
                </div>
              </div>

              {/* Progress bar */}
              {progress.targetCount > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Postęp</span>
                    <span>{progress.totalCreated}/{progress.targetCount - progress.stillNeeded + progress.totalCreated}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (progress.totalCreated / Math.max(1, progress.targetCount - progress.stillNeeded + progress.totalCreated)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Recent words */}
            {progress.recentWords.length > 0 && (
              <div className="p-3 bg-green-50 border-b">
                <div className="text-xs text-green-700 font-medium mb-1">Ostatnio dodane:</div>
                <div className="flex flex-wrap gap-1">
                  {progress.recentWords.slice(0, 15).map((word, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 overflow-auto p-3 bg-gray-900 text-gray-100 font-mono text-xs min-h-[200px] max-h-[300px]">
              {progress.logs.length === 0 ? (
                <div className="text-gray-500">Oczekiwanie na logi...</div>
              ) : (
                progress.logs.map((log, i) => (
                  <div key={i} className={`py-0.5 ${
                    log.includes('BŁĄD') ? 'text-red-400' :
                    log.includes('GOTOWE') ? 'text-green-400' :
                    log.includes('Zakończono') ? 'text-green-400 font-bold' :
                    log.includes('batch') && log.includes('+') ? 'text-purple-400' :
                    'text-gray-300'
                  }`}>
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Footer */}
            {progress.status === 'complete' && (
              <div className="p-4 bg-green-50 border-t text-center">
                <div className="text-green-700 font-medium">
                  Generowanie zakończone pomyślnie!
                </div>
                <Button
                  onClick={() => {
                    setShowProgressModal(false)
                    setProgress(initialProgress)
                  }}
                  className="mt-2"
                >
                  Zamknij
                </Button>
              </div>
            )}

            {progress.status === 'error' && (
              <div className="p-4 bg-red-50 border-t text-center">
                <div className="text-red-700 font-medium">
                  Wystąpił błąd: {progress.error}
                </div>
                <Button
                  onClick={() => {
                    setShowProgressModal(false)
                    setProgress(initialProgress)
                  }}
                  variant="secondary"
                  className="mt-2"
                >
                  Zamknij
                </Button>
              </div>
            )}

            {progress.status === 'running' && (
              <div className="p-3 bg-purple-50 border-t text-center text-sm text-purple-700">
                Trwa generowanie... Nie zamykaj tej strony.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
