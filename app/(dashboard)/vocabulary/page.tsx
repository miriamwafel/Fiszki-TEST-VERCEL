'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'

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

export default function VocabularyIndexPage() {
  const [languages, setLanguages] = useState<LanguageStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        // Pobierz statystyki dla każdego języka
        const supportedLanguages = ['en', 'de', 'es', 'fr', 'it']
        const stats: LanguageStats[] = []

        for (const lang of supportedLanguages) {
          const response = await fetch(`/api/vocabulary/${lang}?limit=1&_t=${Date.now()}`, {
            cache: 'no-store',
          })

          if (response.ok) {
            const data = await response.json()
            if (data.stats && data.stats.total > 0) {
              stats.push({
                language: lang,
                ...data.stats,
              })
            }
          }
        }

        setLanguages(stats)
      } catch (error) {
        console.error('Failed to fetch languages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLanguages()
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Baza słownictwa</h1>
        <p className="text-gray-600 mt-2">
          Przeglądaj najważniejsze słowa dla każdego języka i śledź swój postęp w nauce
        </p>
      </div>

      {languages.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Baza słownictwa jest pusta
          </h2>
          <p className="text-gray-600">
            Administrator musi najpierw wygenerować bazę słów dla poszczególnych języków.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {languages.map((lang) => {
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
          <li>• Każdy język ma bazę najważniejszych słów uporządkowanych według częstotliwości użycia</li>
          <li>• Oznaczaj słowa jako "znane", "w nauce" lub "nieznane"</li>
          <li>• Gdy dodajesz fiszki, odpowiadające słowa są automatycznie oznaczane</li>
          <li>• Historyjki AI będą używać słów, których jeszcze nie znasz</li>
        </ul>
      </div>
    </div>
  )
}
