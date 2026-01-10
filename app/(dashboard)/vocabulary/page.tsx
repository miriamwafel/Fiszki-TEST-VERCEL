'use client'

import { useState, useEffect } from 'react'
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

export default function VocabularyIndexPage() {
  const [languages, setLanguages] = useState<LanguageStats[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingFull, setGeneratingFull] = useState<string | null>(null)

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
  }, [])

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
    toast.info(`Generuję pełną bazę słów ${languageNames[language]} (~2000 słów, wszystkie poziomy)...`, {
      duration: 120000, // 2 minuty
      description: 'To może potrwać kilka minut. Nie zamykaj strony.',
    })

    try {
      const response = await fetch(`/api/vocabulary/${language}/generate-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Wygenerowano ${data.totalCreated} słów dla ${languageNames[language]}!`, {
          description: `Pominięto ${data.totalSkipped} duplikatów`,
        })
        // Odśwież listę
        await fetchLanguages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Błąd generowania')
      }
    } catch {
      toast.error('Błąd połączenia')
    } finally {
      setGeneratingFull(null)
    }
  }

  const generateLevelVocabulary = async (language: string, level: string) => {
    if (generating || generatingFull) return

    const cefrTargets: Record<string, number> = {
      A1: 300, A2: 500, B1: 600, B2: 400, C1: 150, C2: 50
    }

    setGenerating(`${language}-${level}`)
    toast.info(`Generuję ${languageNames[language]} poziom ${level} (~${cefrTargets[level]} słów)...`, {
      duration: 60000,
      description: 'Może potrwać 1-2 minuty.',
    })

    try {
      const response = await fetch(`/api/vocabulary/${language}/generate-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      })

      if (response.ok) {
        const data = await response.json()
        const levelData = data.byLevel?.[level]
        toast.success(`${languageNames[language]} ${level}: +${levelData?.created || data.totalCreated} słów`, {
          description: levelData?.skipped ? `Pominięto ${levelData.skipped} duplikatów` : undefined,
        })
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

          {/* Info o CEFR */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200 text-sm">
            <p className="font-medium text-purple-900 mb-2">Rozkład CEFR (~2000 słów):</p>
            <div className="grid grid-cols-6 gap-1 text-center text-xs">
              <div className="bg-green-100 p-1 rounded"><span className="font-bold">A1</span><br/>300</div>
              <div className="bg-green-200 p-1 rounded"><span className="font-bold">A2</span><br/>500</div>
              <div className="bg-yellow-100 p-1 rounded"><span className="font-bold">B1</span><br/>600</div>
              <div className="bg-yellow-200 p-1 rounded"><span className="font-bold">B2</span><br/>400</div>
              <div className="bg-orange-100 p-1 rounded"><span className="font-bold">C1</span><br/>150</div>
              <div className="bg-orange-200 p-1 rounded"><span className="font-bold">C2</span><br/>50</div>
            </div>
          </div>

          {/* Generowanie pełnej bazy */}
          <div className="mb-6">
            <h3 className="font-semibold text-purple-800 mb-2">Generuj pełną bazę (wszystkie poziomy)</h3>
            <p className="text-sm text-purple-700 mb-3">
              Wygeneruje brakujące słowa dla wszystkich poziomów. Może trwać kilka minut.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {supportedLanguages.map(lang => (
                <div key={`full-${lang}`} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-purple-300">
                  <span className="text-2xl">{languageFlags[lang]}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{languageNames[lang]}</div>
                    <div className="text-xs text-gray-500">
                      {languages.find(l => l.language === lang)?.total || 0} słów
                    </div>
                  </div>
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
              ))}
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
            const progress = lang.total > 0
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
                      <span>{progress}%</span>
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
    </div>
  )
}
