'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'

interface SetReviewItem {
  id: string
  scheduledDate: string
  dayOffset: number
  completed: boolean
  type: 'set'
  setId: string
  set: {
    id: string
    name: string
    language: string
    _count: { flashcards: number }
  }
}

interface GrammarReviewItem {
  id: string
  scheduledDate: string
  dayOffset: number
  completed: boolean
  type: 'grammar'
  moduleId: string
  moduleName: string
  language: string
  level: string
}

type ReviewItem = SetReviewItem | GrammarReviewItem

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

export function ReviewCalendar() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews')
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews || [])
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generuj 14 dni od dziś
  const days: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const day = new Date(today)
    day.setDate(day.getDate() + i)
    days.push(day)
  }

  // Grupuj reviews po dacie
  const reviewsByDate: Record<string, ReviewItem[]> = {}
  for (const review of reviews) {
    const dateKey = new Date(review.scheduledDate).toISOString().split('T')[0]
    if (!reviewsByDate[dateKey]) {
      reviewsByDate[dateKey] = []
    }
    reviewsByDate[dateKey].push(review)
  }

  // Policz nieukończone powtórki na dziś
  const todayKey = today.toISOString().split('T')[0]
  const todaysReviews = reviewsByDate[todayKey]?.filter(r => !r.completed) || []
  const overdueReviews = reviews.filter(r => {
    const reviewDate = new Date(r.scheduledDate)
    reviewDate.setHours(0, 0, 0, 0)
    return reviewDate < today && !r.completed
  })

  // Grupuj powtórki po językach
  const groupReviewsByLanguage = (reviewsToGroup: ReviewItem[]) => {
    const byLanguage: Record<string, ReviewItem[]> = {}
    for (const review of reviewsToGroup) {
      const lang = review.type === 'set' ? review.set.language : review.language
      if (!byLanguage[lang]) {
        byLanguage[lang] = []
      }
      byLanguage[lang].push(review)
    }
    return byLanguage
  }

  // Helper do pobierania linku
  const getReviewLink = (review: ReviewItem) => {
    if (review.type === 'grammar') {
      return `/grammar/${review.moduleId}`
    }
    return `/sets/${review.set.id}`
  }

  // Helper do pobierania nazwy
  const getReviewName = (review: ReviewItem) => {
    if (review.type === 'grammar') {
      return review.moduleName
    }
    return review.set.name
  }

  // Helper do pobierania opisu
  const getReviewDescription = (review: ReviewItem, isOverdue: boolean) => {
    if (review.type === 'grammar') {
      const desc = `Gramatyka ${review.level}`
      if (isOverdue) {
        return (
          <>
            {desc}
            <span className="text-red-600 ml-2">
              · {new Date(review.scheduledDate).toLocaleDateString('pl-PL')}
            </span>
          </>
        )
      }
      return desc
    }
    return (
      <>
        {review.set._count.flashcards} fiszek
        {isOverdue && (
          <span className="text-red-600 ml-2">
            · {new Date(review.scheduledDate).toLocaleDateString('pl-PL')}
          </span>
        )}
      </>
    )
  }

  const formatDayName = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.getTime() === today.getTime()) return 'Dziś'
    if (date.getTime() === tomorrow.getTime()) return 'Jutro'

    return date.toLocaleDateString('pl-PL', { weekday: 'short' })
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin border-t-gray-500" />
          Ładowanie powtórek...
        </div>
      </Card>
    )
  }

  // Brak żadnych zaplanowanych powtórek
  if (reviews.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Brak zaplanowanych powtórek</h3>
            <p className="text-sm text-gray-500 mt-1">
              Włącz harmonogram powtórek w zestawach fiszek lub modułach gramatycznych.
            </p>
            <div className="flex gap-3 mt-2">
              <Link href="/sets" className="text-sm text-primary-600 hover:underline">
                Zestawy →
              </Link>
              <Link href="/grammar" className="text-sm text-purple-600 hover:underline">
                Gramatyka →
              </Link>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Przygotuj dane do wyświetlenia
  const displayReviews = selectedDate
    ? reviewsByDate[selectedDate] || []
    : [...overdueReviews, ...todaysReviews]

  const reviewsByLanguage = groupReviewsByLanguage(displayReviews.filter(r => !r.completed))
  const sortedLanguages = Object.keys(reviewsByLanguage).sort(
    (a, b) => reviewsByLanguage[b].length - reviewsByLanguage[a].length
  )

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Kalendarz powtórek</h3>
        {(todaysReviews.length > 0 || overdueReviews.length > 0) && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            overdueReviews.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {overdueReviews.length > 0
              ? `${overdueReviews.length} zaległych!`
              : `${todaysReviews.length} na dziś`}
          </span>
        )}
      </div>

      {/* Mini kalendarz - 14 dni */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        {days.map((day) => {
          const dateKey = day.toISOString().split('T')[0]
          const dayReviews = reviewsByDate[dateKey] || []
          const pendingCount = dayReviews.filter(r => !r.completed).length
          const isToday = day.getTime() === today.getTime()
          const isSelected = selectedDate === dateKey

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(isSelected ? null : dateKey)}
              className={`flex-shrink-0 w-12 p-2 rounded-lg text-center transition-colors ${
                isSelected
                  ? 'bg-primary-100 border-2 border-primary-500'
                  : isToday
                  ? 'bg-primary-50 border-2 border-primary-300'
                  : pendingCount > 0
                  ? 'bg-blue-50 hover:bg-blue-100'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className={`text-xs ${isToday ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                {formatDayName(day)}
              </div>
              <div className={`text-lg font-semibold ${
                isToday ? 'text-primary-700' : 'text-gray-900'
              }`}>
                {day.getDate()}
              </div>
              {pendingCount > 0 && (
                <div className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center text-xs font-medium ${
                  isToday ? 'bg-primary-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                  {pendingCount}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista powtórek pogrupowana po językach */}
      <div className="space-y-4">
        {sortedLanguages.length === 0 && !selectedDate && (
          <p className="text-sm text-gray-500 text-center py-4">
            Brak powtórek na dziś - świetna robota!
          </p>
        )}

        {sortedLanguages.length === 0 && selectedDate && (
          <p className="text-sm text-gray-500 text-center py-4">
            Brak powtórek na ten dzień
          </p>
        )}

        {sortedLanguages.map((language) => (
          <div key={language}>
            {/* Nagłówek języka */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{languageFlags[language] || '🌍'}</span>
              <span className="text-sm font-medium text-gray-700">
                {languageNames[language] || language}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {reviewsByLanguage[language].length}
              </span>
            </div>

            {/* Powtórki dla tego języka */}
            <div className="space-y-2 ml-7">
              {reviewsByLanguage[language].map((review) => {
                const reviewDate = new Date(review.scheduledDate)
                reviewDate.setHours(0, 0, 0, 0)
                const isOverdue = reviewDate < today
                const isGrammar = review.type === 'grammar'

                return (
                  <Link
                    key={review.id}
                    href={getReviewLink(review)}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isOverdue
                        ? 'bg-red-50 hover:bg-red-100'
                        : isGrammar
                        ? 'bg-purple-50 hover:bg-purple-100'
                        : 'bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isGrammar ? (
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                          isOverdue ? 'bg-red-200 text-red-700' : 'bg-purple-200 text-purple-700'
                        }`}>
                          G
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded-full border-2 ${
                          isOverdue ? 'border-red-400' : 'border-green-400'
                        }`} />
                      )}
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {getReviewName(review)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getReviewDescription(review, isOverdue)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isOverdue
                        ? 'bg-red-200 text-red-800'
                        : isGrammar
                        ? 'bg-purple-200 text-purple-800'
                        : 'bg-green-200 text-green-800'
                    }`}>
                      {isOverdue ? 'Zaległe' : 'Do zrobienia'}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* Ukończone powtórki na wybrany dzień */}
        {selectedDate && reviewsByDate[selectedDate]?.filter(r => r.completed).length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 mb-2">Ukończone</p>
            {reviewsByDate[selectedDate].filter(r => r.completed).map((review) => (
              <Link
                key={review.id}
                href={getReviewLink(review)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors mb-2"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-medium text-sm text-gray-500 line-through">
                      {getReviewName(review)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {review.type === 'grammar'
                        ? `${languageFlags[review.language]} Gramatyka ${review.level}`
                        : `${languageFlags[review.set.language]} ${review.set._count.flashcards} fiszek`
                      }
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
