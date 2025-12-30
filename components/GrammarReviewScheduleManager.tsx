'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'

interface Review {
  id: string
  scheduledDate: string
  dayOffset: number
  completed: boolean
  completedAt: string | null
}

interface GrammarReviewScheduleManagerProps {
  moduleId: string
  moduleName: string
}

export function GrammarReviewScheduleManager({ moduleId, moduleName }: GrammarReviewScheduleManagerProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    fetchReviews()
  }, [moduleId])

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/grammar/${moduleId}/reviews`)
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
      const response = await fetch(`/api/grammar/${moduleId}/reviews`, {
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
    } finally {
      setCreating(false)
    }
  }

  const markCompleted = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/grammar/${moduleId}/reviews`, {
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

  const updateReviewDate = async (reviewId: string) => {
    if (!editDate) return

    try {
      const response = await fetch(`/api/grammar/${moduleId}/reviews`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, scheduledDate: editDate }),
      })

      if (response.ok) {
        const updated = await response.json()
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, scheduledDate: updated.scheduledDate } : r
        ))
        setEditingId(null)
        setEditDate('')
      }
    } catch (error) {
      console.error('Failed to update review date:', error)
    }
  }

  const deleteReview = async (reviewId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę powtórkę?')) return

    try {
      const response = await fetch(`/api/grammar/${moduleId}/reviews?reviewId=${reviewId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setReviews(reviews.filter(r => r.id !== reviewId))
      }
    } catch (error) {
      console.error('Failed to delete review:', error)
    }
  }

  const startEditing = (review: Review) => {
    setEditingId(review.id)
    setEditDate(review.scheduledDate.split('T')[0])
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
    date.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-200 rounded-full animate-spin border-t-gray-500" />
          <span className="text-sm">Ładowanie...</span>
        </div>
      </div>
    )
  }

  // Brak harmonogramu
  if (reviews.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Powtórki
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Zaplanuj powtórki, żeby lepiej zapamiętać
            </p>
          </div>
          <Button onClick={createSchedule} loading={creating} className="w-full sm:w-auto">
            Włącz powtórki
          </Button>
        </div>
      </div>
    )
  }

  const pendingReviews = reviews.filter(r => !r.completed)
  const completedReviews = reviews.filter(r => r.completed)
  const nextReview = pendingReviews[0]

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            nextReview && isOverdue(nextReview.scheduledDate)
              ? 'bg-red-100'
              : nextReview && isToday(nextReview.scheduledDate)
              ? 'bg-green-100'
              : pendingReviews.length === 0
              ? 'bg-gray-100'
              : 'bg-purple-100'
          }`}>
            <svg className={`w-5 h-5 ${
              nextReview && isOverdue(nextReview.scheduledDate)
                ? 'text-red-600'
                : nextReview && isToday(nextReview.scheduledDate)
                ? 'text-green-600'
                : pendingReviews.length === 0
                ? 'text-gray-400'
                : 'text-purple-600'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Powtórki</h3>
            {nextReview ? (
              <p className={`text-sm ${
                isOverdue(nextReview.scheduledDate)
                  ? 'text-red-600 font-medium'
                  : isToday(nextReview.scheduledDate)
                  ? 'text-green-600 font-medium'
                  : 'text-gray-500'
              }`}>
                {isOverdue(nextReview.scheduledDate)
                  ? 'Zaległa powtórka!'
                  : isToday(nextReview.scheduledDate)
                  ? 'Powtórka na dziś!'
                  : `Następna: ${formatDate(nextReview.scheduledDate)}`}
              </p>
            ) : (
              <p className="text-sm text-green-600">Wszystkie ukończone!</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
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
        <div className="border-t border-gray-100 p-4 space-y-2 bg-gray-50">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`flex items-center justify-between p-3 rounded-lg bg-white border ${
                review.completed
                  ? 'border-gray-200 text-gray-500'
                  : isOverdue(review.scheduledDate)
                  ? 'border-red-200 bg-red-50'
                  : isToday(review.scheduledDate)
                  ? 'border-green-200 bg-green-50'
                  : 'border-purple-200 bg-purple-50'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {review.completed ? (
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    isOverdue(review.scheduledDate)
                      ? 'border-red-400'
                      : isToday(review.scheduledDate)
                      ? 'border-green-400'
                      : 'border-purple-400'
                  }`} />
                )}

                {editingId === review.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="text-sm border rounded px-2 py-1 flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateReviewDate(review.id)
                      }}
                      className="text-green-600 hover:text-green-700 p-1"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(null)
                        setEditDate('')
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${
                      review.completed
                        ? 'line-through text-gray-400'
                        : isOverdue(review.scheduledDate)
                        ? 'text-red-700'
                        : isToday(review.scheduledDate)
                        ? 'text-green-700'
                        : 'text-purple-700'
                    }`}>
                      {formatDate(review.scheduledDate)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      +{review.dayOffset}d
                    </span>
                  </div>
                )}
              </div>

              {!review.completed && editingId !== review.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditing(review)
                    }}
                    className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                    title="Edytuj datę"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteReview(review.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    title="Usuń"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      markCompleted(review.id)
                    }}
                    className="ml-1 px-2 py-1 text-xs font-medium bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                  >
                    Gotowe
                  </button>
                </div>
              )}

              {review.completed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteReview(review.id)
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                  title="Usuń"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <div className="pt-2 flex justify-end">
            <button
              onClick={createSchedule}
              disabled={creating}
              className="text-sm text-gray-500 hover:text-purple-600 transition-colors disabled:opacity-50"
            >
              {creating ? 'Resetowanie...' : 'Zresetuj harmonogram'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
