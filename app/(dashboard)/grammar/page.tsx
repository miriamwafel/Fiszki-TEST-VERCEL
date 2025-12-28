'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'

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

const levelColors: Record<string, string> = {
  A1: 'bg-green-100 text-green-700 border-green-300',
  A2: 'bg-green-200 text-green-800 border-green-400',
  B1: 'bg-blue-100 text-blue-700 border-blue-300',
  B2: 'bg-blue-200 text-blue-800 border-blue-400',
  C1: 'bg-purple-100 text-purple-700 border-purple-300',
  C2: 'bg-purple-200 text-purple-800 border-purple-400',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gramatyka</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Wybierz język i poziom
        </h2>

        {/* Wybór języka */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Język
          </label>
          <div className="flex flex-wrap gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setSelectedLanguage(lang.code)
                  setSelectedLevel('')
                  setModules([])
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="text-2xl">{languageFlags[lang.code] || '🌍'}</span>
                <span className="font-medium">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Wybór poziomu */}
        {selectedLang && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Poziom zaawansowania
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedLang.levels.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
                    selectedLevel === level
                      ? `${levelColors[level]} border-2 shadow-md`
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Lista modułów */}
      {selectedLevel && (
        <div>
          {/* Nagłówek z postępem */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Plan nauki - {selectedLang?.name} {selectedLevel}
            </h2>
            {modules.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600">
                  ✓ {completedModules} ukończonych
                </span>
                <span className="text-blue-600">
                  ◐ {startedModules} w trakcie
                </span>
                <span className="text-gray-500">
                  ○ {modules.length - completedModules - startedModules} do zrobienia
                </span>
              </div>
            )}
          </div>

          {loadingModules ? (
            <Card className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Ładowanie modułów...</p>
            </Card>
          ) : modules.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Brak modułów dla tego poziomu</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {modules.map((module, index) => (
                <Link
                  key={module.id}
                  href={`/grammar/${module.id}`}
                >
                  <Card
                    variant="interactive"
                    className={`p-5 ${
                      module.completed
                        ? 'bg-green-50 border-green-200'
                        : module.started
                        ? 'bg-blue-50 border-blue-200'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Numer/Status */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                        module.completed
                          ? 'bg-green-500 text-white'
                          : module.started
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {module.completed ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </div>

                      {/* Treść */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {module.titlePl}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {module.descriptionPl}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              ~{module.estimatedMinutes} min
                            </span>
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>

                        {/* Status */}
                        {module.completed && (
                          <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Ukończone
                          </span>
                        )}
                        {module.started && !module.completed && (
                          <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            W trakcie
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pusty stan */}
      {!selectedLanguage && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz język</h3>
          <p className="text-gray-500">
            Wybierz język, aby zobaczyć dostępne moduły gramatyczne i rozpocząć naukę.
          </p>
        </Card>
      )}
    </div>
  )
}
