'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface LanguageInfo {
  code: string
  name: string
  levels: string[]
}

interface ModuleProgress {
  started: boolean
  completed: boolean
}

interface GrammarModule {
  id: string
  title: string
  titlePl: string
  description: string
  descriptionPl: string
  order: number
  estimatedMinutes: number
  progress: ModuleProgress | null
  started: boolean
  completed: boolean
}

const languageFlags: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
  pt: '🇵🇹',
  ru: '🇷🇺',
}

const languageGradients: Record<string, string> = {
  en: 'from-blue-500 to-red-500',
  de: 'from-gray-800 to-yellow-500',
  es: 'from-red-500 to-yellow-500',
  fr: 'from-blue-500 to-red-400',
  it: 'from-green-500 to-red-500',
}

const levelStyles: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  A1: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-500', gradient: 'from-emerald-400 to-emerald-600' },
  A2: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600', gradient: 'from-emerald-500 to-emerald-700' },
  B1: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500', gradient: 'from-blue-400 to-blue-600' },
  B2: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', gradient: 'from-blue-500 to-blue-700' },
  C1: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500', gradient: 'from-purple-400 to-purple-600' },
  C2: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600', gradient: 'from-purple-500 to-purple-700' },
}

export default function GrammarPage() {
  const [languages, setLanguages] = useState<LanguageInfo[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [modules, setModules] = useState<GrammarModule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingModules, setLoadingModules] = useState(false)

  useEffect(() => {
    fetchLanguages()
  }, [])

  useEffect(() => {
    if (selectedLanguage && selectedLevel) {
      fetchModules()
    }
  }, [selectedLanguage, selectedLevel])

  const fetchLanguages = async () => {
    try {
      const response = await fetch('/api/grammar')
      const data = await response.json()
      setLanguages(data.languages || [])
    } catch (error) {
      console.error('Failed to fetch languages:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchModules = async () => {
    setLoadingModules(true)
    try {
      const response = await fetch(`/api/grammar?language=${selectedLanguage}&level=${selectedLevel}`)
      const data = await response.json()
      setModules(data.modules || [])
    } catch (error) {
      console.error('Failed to fetch modules:', error)
    } finally {
      setLoadingModules(false)
    }
  }

  const selectedLang = languages.find(l => l.code === selectedLanguage)

  // Oblicz postęp
  const completedModules = modules.filter(m => m.completed).length
  const startedModules = modules.filter(m => m.started && !m.completed).length
  const progressPercent = modules.length > 0 ? (completedModules / modules.length) * 100 : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-gray-500">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gramatyka</h1>
        <p className="text-gray-500 text-lg">
          Wybierz język i poziom, aby rozpocząć naukę gramatyki z AI
        </p>
      </div>

      {/* Language selection */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
            🌍
          </span>
          Wybierz język
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {languages.map((lang) => {
            const gradient = languageGradients[lang.code] || 'from-gray-500 to-gray-700'
            const isSelected = selectedLanguage === lang.code

            return (
              <button
                key={lang.code}
                onClick={() => {
                  setSelectedLanguage(lang.code)
                  setSelectedLevel('')
                  setModules([])
                }}
                className={`relative overflow-hidden rounded-xl p-5 text-left transition-all ${
                  isSelected
                    ? 'ring-4 ring-primary-500 ring-offset-2'
                    : 'hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-90`} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">{languageFlags[lang.code] || '🌍'}</span>
                    <span className="text-xl font-bold text-white">{lang.name}</span>
                  </div>
                  <p className="text-white/80 text-sm">
                    {lang.levels.length} poziomów
                  </p>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Level selection */}
      {selectedLang && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
              📊
            </span>
            Wybierz poziom
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {selectedLang.levels.map((level) => {
              const style = levelStyles[level] || levelStyles.A1
              const isSelected = selectedLevel === level

              return (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`relative overflow-hidden rounded-xl p-4 text-center transition-all ${
                    isSelected
                      ? 'ring-4 ring-offset-2 ring-primary-500 shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  {isSelected && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`} />
                  )}
                  <span className={`relative text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                    {level}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500" /> A1-A2: Podstawowy
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500" /> B1-B2: Średniozaawansowany
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-500" /> C1-C2: Zaawansowany
            </span>
          </div>
        </div>
      )}

      {/* Modules list */}
      {selectedLevel && (
        <div>
          {/* Progress header */}
          {modules.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{languageFlags[selectedLanguage]}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedLang?.name} - Poziom {selectedLevel}
                    </h2>
                    <p className="text-gray-500">{modules.length} modułów do nauki</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary-600">{Math.round(progressPercent)}%</div>
                  <div className="text-sm text-gray-500">ukończone</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{completedModules}</div>
                    <div className="text-xs text-gray-500">ukończonych</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{startedModules}</div>
                    <div className="text-xs text-gray-500">w trakcie</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{modules.length - completedModules - startedModules}</div>
                    <div className="text-xs text-gray-500">do nauki</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loadingModules ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
              <div className="relative w-12 h-12 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-primary-200 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-primary-600 rounded-full animate-spin" />
              </div>
              <p className="text-gray-500">Ładowanie modułów...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📭</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak modułów</h3>
              <p className="text-gray-500">Dla tego poziomu nie ma jeszcze dostępnych modułów gramatycznych.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((module, index) => (
                <Link
                  key={module.id}
                  href={`/grammar/${module.id}`}
                  className="block"
                >
                  <div
                    className={`bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                      module.completed
                        ? 'border-green-200 bg-gradient-to-r from-green-50 to-white'
                        : module.started
                        ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-white'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Number/Status indicator */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold ${
                        module.completed
                          ? 'bg-green-500 text-white'
                          : module.started
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {module.completed ? (
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              {module.titlePl}
                            </h3>
                            <p className="text-gray-500 text-sm line-clamp-2">
                              {module.descriptionPl}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-sm text-gray-400 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {module.estimatedMinutes} min
                              </div>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              module.completed ? 'bg-green-100' :
                              module.started ? 'bg-blue-100' :
                              'bg-gray-100'
                            }`}>
                              <svg className={`w-5 h-5 ${
                                module.completed ? 'text-green-600' :
                                module.started ? 'text-blue-600' :
                                'text-gray-400'
                              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="flex items-center gap-2 mt-3">
                          {module.completed && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Ukończone
                            </span>
                          )}
                          {module.started && !module.completed && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              W trakcie
                            </span>
                          )}
                          {!module.started && !module.completed && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                              Nie rozpoczęto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedLanguage && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📚</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Wybierz język na początek</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Wybierz język powyżej, aby zobaczyć dostępne moduły gramatyczne i rozpocząć naukę z pomocą AI.
          </p>
        </div>
      )}
    </div>
  )
}
