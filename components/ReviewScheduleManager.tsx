'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'

interface Review {
  id: string
  scheduledDate: string
  dayOffset: number
  completed: boolean
  completedAt: string | null
}

interface ReviewScheduleManagerProps {
  setId: string
  setCreatedAt: string
}

export function ReviewScheduleManager({ setId, setCreatedAt }: ReviewScheduleManagerProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchReviews()
  }, [setId])

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/sets/${setId}/reviews`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data)
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const createSchedule = async () => {
    setCreating(true)
    try {
      const response = await fetch(`/api/sets/${setId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        setReviews(data)
        setExpanded(true)
      }
    } catch (error) {
      console.error('Failed to create schedule:', error)
      alert('Nie udało się utworzyć harmonogramu')
    } finally {
      setCreating(false)
    }
  }

  const markCompleted = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/sets/${setId}/reviews`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, completed: true }),
      })

      if (response.ok) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, completed: true, completedAt: new Date().toISOString() } : r
        ))
      }
    } catch (error) {
      console.error('Failed to mark review as completed:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    today.setHours(0, 0, 0, 0)
    tomorrow.setHours(0, 0, 0, 0)
    const reviewDate = new Date(date)
    reviewDate.setHours(0, 0, 0, 0)

    if (reviewDate.getTime() === today.getTime()) {
      return 'Dzisiaj'
    } else if (reviewDate.getTime() === tomorrow.getTime()) {
      return 'Jutro'
    }

    return date.toLocaleDateString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const isOverdue = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date < today
  }

  const isToday = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin border-t-gray-500" />
          Ładowanie harmonogramu...
        </div>
      </Card>
    )
  }

  // Brak harmonogramu - pokaż przycisk do utworzenia
  if (reviews.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Harmonogram powtórek</h3>
            <p className="text-sm text-gray-500">
              Włącz powtórki, aby system przypominał o nauce
            </p>
          </div>
          <Button onClick={createSchedule} loading={creating}>
            Włącz powtórki
          </Button>
        </div>
      </Card>
    )
  }

  const pendingReviews = reviews.filter(r => !r.completed)
  const completedReviews = reviews.filter(r => r.completed)
  const nextReview = pendingReviews[0]

  return (
    <Card className="p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            nextReview && isOverdue(nextReview.scheduledDate) && !nextReview.completed
              ? 'bg-red-100'
              : nextReview && isToday(nextReview.scheduledDate)
              ? 'bg-green-100'
              : 'bg-blue-100'
          }`}>
            <svg className={`w-5 h-5 ${
              nextReview && isOverdue(nextReview.scheduledDate) && !nextReview.completed
                ? 'text-red-600'
                : nextReview && isToday(nextReview.scheduledDate)
                ? 'text-green-600'
                : 'text-blue-600'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Harmonogram powtórek</h3>
            {nextReview ? (
              <p className={`text-sm ${
                isOverdue(nextReview.scheduledDate)
                  ? 'text-red-600 font-medium'
                  : isToday(nextReview.scheduledDate)
                  ? 'text-green-600 font-medium'
                  : 'text-gray-500'
              }`}>
                {isOverdue(nextReview.scheduledDate)
                  ? `Zaległa powtórka!`
                  : isToday(nextReview.scheduledDate)
                  ? 'Powtórka na dziś!'
                  : `Następna: ${formatDate(nextReview.scheduledDate)}`}
              </p>
            ) : (
              <p className="text-sm text-green-600">Wszystkie powtórki ukończone!</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {completedReviews.length}/{reviews.length}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-2">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                review.completed
                  ? 'bg-gray-50 text-gray-500'
                  : isOverdue(review.scheduledDate)
                  ? 'bg-red-50'
                  : isToday(review.scheduledDate)
                  ? 'bg-green-50'
                  : 'bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {review.completed ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    isOverdue(review.scheduledDate)
                      ? 'border-red-400'
                      : isToday(review.scheduledDate)
                      ? 'border-green-400'
                      : 'border-blue-400'
                  }`} />
                )}
                <div>
                  <span className={`text-sm font-medium ${
                    review.completed
                      ? 'line-through text-gray-400'
                      : isOverdue(review.scheduledDate)
                      ? 'text-red-700'
                      : isToday(review.scheduledDate)
                      ? 'text-green-700'
                      : 'text-blue-700'
                  }`}>
                    {formatDate(review.scheduledDate)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    (+{review.dayOffset} {review.dayOffset === 1 ? 'dzień' : 'dni'})
                  </span>
                </div>
              </div>

              {!review.completed && (
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    markCompleted(review.id)
                  }}
                  className="text-xs py-1 px-2"
                >
                  Ukończ
                </Button>
              )}
            </div>
          ))}

          <div className="pt-2 flex justify-end">
            <Button
              variant="secondary"
              onClick={createSchedule}
              loading={creating}
              className="text-sm"
            >
              Zresetuj harmonogram
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
