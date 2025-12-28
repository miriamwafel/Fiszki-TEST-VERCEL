'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'

const DEFAULT_REVIEW_DAYS = [1, 5, 15, 35, 90]

export default function SettingsPage() {
  const [reviewDays, setReviewDays] = useState<number[]>(DEFAULT_REVIEW_DAYS)
  const [maxReviewsPerDay, setMaxReviewsPerDay] = useState(2)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newDay, setNewDay] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      if (data.defaultReviewDays) {
        setReviewDays(data.defaultReviewDays)
      }
      if (data.maxReviewsPerDay) {
        setMaxReviewsPerDay(data.maxReviewsPerDay)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultReviewDays: reviewDays,
          maxReviewsPerDay,
        }),
      })

      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Nie udało się zapisać ustawień')
    } finally {
      setSaving(false)
    }
  }

  const addDay = () => {
    const day = parseInt(newDay)
    if (day > 0 && !reviewDays.includes(day)) {
      setReviewDays([...reviewDays, day].sort((a, b) => a - b))
      setNewDay('')
    }
  }

  const removeDay = (day: number) => {
    if (day === 1) return // Dzień 1 jest stały
    setReviewDays(reviewDays.filter(d => d !== day))
  }

  const resetToDefault = () => {
    setReviewDays(DEFAULT_REVIEW_DAYS)
    setMaxReviewsPerDay(2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia</h1>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Harmonogram powtórek
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Ustaw domyślne dni, w których będą zaplanowane powtórki po utworzeniu zestawu.
          Dzień +1 jest zawsze stały i nie może być zmieniony ani usunięty.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dni powtórek (od daty utworzenia zestawu)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {reviewDays.map((day) => (
              <span
                key={day}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                  day === 1
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                +{day} {day === 1 ? 'dzień' : 'dni'}
                {day !== 1 && (
                  <button
                    onClick={() => removeDay(day)}
                    className="ml-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              id="newDay"
              type="number"
              placeholder="Dodaj dzień..."
              value={newDay}
              onChange={(e) => setNewDay(e.target.value)}
              min="2"
              className="w-32"
            />
            <Button variant="secondary" onClick={addDay} disabled={!newDay}>
              Dodaj
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maksymalna liczba powtórek na dzień
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Jeśli na dany dzień jest więcej powtórek, system zaproponuje przesunięcie na najbliższy wolny termin.
          </p>
          <Input
            id="maxReviews"
            type="number"
            value={maxReviewsPerDay.toString()}
            onChange={(e) => setMaxReviewsPerDay(parseInt(e.target.value) || 2)}
            min="1"
            max="10"
            className="w-24"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="secondary" onClick={resetToDefault}>
            Przywróć domyślne
          </Button>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Zapisano!
              </span>
            )}
            <Button onClick={handleSave} loading={saving}>
              Zapisz ustawienia
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">Jak działają powtórki?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Po utworzeniu zestawu możesz włączyć harmonogram powtórek</li>
          <li>System automatycznie zaplanuje powtórki według ustawionych dni</li>
          <li>Dzień +1 jest zawsze następnego dnia po utworzeniu</li>
          <li>Pozostałe dni mogą być przesunięte jeśli masz za dużo powtórek tego dnia</li>
          <li>Na dashboardzie zobaczysz kalendarz z zaplanowanymi powtórkami</li>
        </ul>
      </Card>
    </div>
  )
}
