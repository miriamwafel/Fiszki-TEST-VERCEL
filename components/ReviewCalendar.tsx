'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'

interface ReviewItem {
  id: string
  scheduledDate: string
  dayOffset: number
  completed: boolean
  set: {
    id: string
    name: string
    language: string
    _count: { flashcards: number }
  }
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
              Włącz harmonogram powtórek w swoich zestawach, aby śledzić postępy nauki.
            </p>
            <Link href="/sets" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
              Przejdź do zestawów →
            </Link>
          </div>
        </div>
      </Card>
    )
  }

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

      {/* Lista powtórek na wybrany dzień lub dziś */}
      <div className="space-y-2">
        {/* Zaległe powtórki */}
        {!selectedDate && overdueReviews.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-red-600 uppercase tracking-wider mb-2">
              Zaległe powtórki
            </h4>
            {overdueReviews.map((review) => (
              <Link
                key={review.id}
                href={`/sets/${review.set.id}`}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors mb-2"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{review.set.name}</p>
                  <p className="text-xs text-red-600">
                    {new Date(review.scheduledDate).toLocaleDateString('pl-PL')} · {review.set._count.flashcards} fiszek
                  </p>
                </div>
                <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                  Zaległe
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Powtórki na wybrany dzień lub dziś */}
        {(selectedDate ? reviewsByDate[selectedDate] : todaysReviews)?.map((review) => (
          <Link
            key={review.id}
            href={`/sets/${review.set.id}`}
            className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
              review.completed
                ? 'bg-gray-50 hover:bg-gray-100'
                : 'bg-green-50 hover:bg-green-100'
            }`}
          >
            <div className="flex items-center gap-3">
              {review.completed ? (
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-green-400" />
              )}
              <div>
                <p className={`font-medium text-sm ${review.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                  {review.set.name}
                </p>
                <p className="text-xs text-gray-500">
                  {review.set._count.flashcards} fiszek · {review.set.language.toUpperCase()}
                </p>
              </div>
            </div>
            {!review.completed && (
              <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                Do zrobienia
              </span>
            )}
          </Link>
        ))}

        {/* Brak powtórek na wybrany dzień */}
        {selectedDate && (!reviewsByDate[selectedDate] || reviewsByDate[selectedDate].length === 0) && (
          <p className="text-sm text-gray-500 text-center py-4">
            Brak powtórek na ten dzień
          </p>
        )}

        {/* Brak powtórek na dziś */}
        {!selectedDate && todaysReviews.length === 0 && overdueReviews.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            Brak powtórek na dziś - świetna robota!
          </p>
        )}
      </div>
    </Card>
  )
}
