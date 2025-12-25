'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Card } from '@/components/Card'

const languages = [
  { value: 'en', label: 'Angielski' },
  { value: 'de', label: 'Niemiecki' },
  { value: 'es', label: 'Hiszpański' },
  { value: 'fr', label: 'Francuski' },
  { value: 'it', label: 'Włoski' },
  { value: 'pt', label: 'Portugalski' },
  { value: 'ru', label: 'Rosyjski' },
  { value: 'ja', label: 'Japoński' },
  { value: 'ko', label: 'Koreański' },
  { value: 'zh', label: 'Chiński' },
  { value: 'nl', label: 'Holenderski' },
  { value: 'sv', label: 'Szwedzki' },
  { value: 'no', label: 'Norweski' },
  { value: 'da', label: 'Duński' },
  { value: 'fi', label: 'Fiński' },
  { value: 'cs', label: 'Czeski' },
  { value: 'uk', label: 'Ukraiński' },
]

export default function NewSetPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('en')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Nazwa zestawu jest wymagana')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, language }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Wystąpił błąd')
        return
      }

      router.push(`/sets/${data.id}`)
    } catch {
      setError('Wystąpił błąd podczas tworzenia zestawu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowy zestaw</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <Input
            id="name"
            label="Nazwa zestawu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Angielski - słówka z pracy"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis (opcjonalnie)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis zestawu..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
            />
          </div>

          <Select
            id="language"
            label="Język, którego się uczysz"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            options={languages}
          />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Anuluj
            </Button>
            <Button type="submit" loading={loading}>
              Utwórz zestaw
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
