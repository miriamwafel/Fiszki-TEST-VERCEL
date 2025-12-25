'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'

interface Flashcard {
  id: string
  word: string
  translation: string
  context?: string | null
  partOfSpeech?: string | null
  infinitive?: string | null
  verbForm?: string | null
  verbTense?: string | null
  verbPerson?: string | null
  grammaticalInfo?: string | null
}

interface FlashcardSet {
  id: string
  name: string
  description?: string | null
  language: string
  flashcards: Flashcard[]
}

interface TranslationResult {
  word: string
  translation: string
  partOfSpeech: string
  context?: string
  infinitive?: string
  verbForm?: string
  verbTense?: string
  verbPerson?: string
  grammaticalInfo?: string
  hasMultipleMeanings: boolean
  alternativeMeanings?: string[]
  suggestInfinitive?: boolean
}

export function SetView({ initialSet }: { initialSet: FlashcardSet }) {
  const router = useRouter()
  const [set, setSet] = useState(initialSet)
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [flashcardToDelete, setFlashcardToDelete] = useState<string | null>(null)

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!word.trim()) return

    setLoading(true)
    setTranslationResult(null)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim(), language: set.language }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setTranslationResult(data)
    } catch (error) {
      console.error('Translation error:', error)
      alert('Wystąpił błąd podczas tłumaczenia')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFlashcard = async (
    wordToAdd: string,
    translation: string,
    context?: string,
    partOfSpeech?: string,
    infinitive?: string,
    verbForm?: string,
    verbTense?: string,
    verbPerson?: string,
    grammaticalInfo?: string
  ) => {
    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: set.id,
          word: wordToAdd,
          translation,
          context,
          partOfSpeech,
          infinitive,
          verbForm,
          verbTense,
          verbPerson,
          grammaticalInfo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSet((prev) => ({
        ...prev,
        flashcards: [data, ...prev.flashcards],
      }))

      setWord('')
      setTranslationResult(null)
    } catch (error) {
      console.error('Add flashcard error:', error)
      alert('Wystąpił błąd podczas dodawania fiszki')
    }
  }

  const handleDeleteSet = async () => {
    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/sets/${set.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete set')
      }

      router.push('/sets')
    } catch (error) {
      console.error('Delete set error:', error)
      alert('Wystąpił błąd podczas usuwania zestawu')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteFlashcard = async (id: string) => {
    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete flashcard')
      }

      setSet((prev) => ({
        ...prev,
        flashcards: prev.flashcards.filter((f) => f.id !== id),
      }))
      setFlashcardToDelete(null)
    } catch (error) {
      console.error('Delete flashcard error:', error)
      alert('Wystąpił błąd podczas usuwania fiszki')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/sets"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Powrót do zestawów
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{set.name}</h1>
          {set.description && (
            <p className="text-gray-500 mt-1">{set.description}</p>
          )}
        </div>
        <div className="flex gap-3">
          {set.flashcards.length > 0 && (
            <Link href={`/sets/${set.id}/practice`}>
              <Button variant="secondary">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Powtórki
              </Button>
            </Link>
          )}
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Add flashcard form */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Dodaj nową fiszkę
        </h2>
        <form onSubmit={handleTranslate} className="flex gap-3">
          <div className="flex-1">
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Wpisz słowo do przetłumaczenia..."
            />
          </div>
          <Button type="submit" loading={loading}>
            Przetłumacz
          </Button>
        </form>

        {translationResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {translationResult.word}
                </p>
                <p className="text-lg text-primary-600">
                  {translationResult.translation}
                </p>
                {translationResult.partOfSpeech && (
                  <p className="text-sm text-gray-500">
                    ({translationResult.partOfSpeech})
                  </p>
                )}
                {translationResult.context && (
                  <p className="text-sm text-gray-600 mt-1">
                    {translationResult.context}
                  </p>
                )}
                {translationResult.grammaticalInfo && (
                  <p className="text-xs text-blue-600 mt-2 italic">
                    📖 {translationResult.grammaticalInfo}
                  </p>
                )}
                {translationResult.infinitive && (
                  <p className="text-xs text-gray-500 mt-1">
                    Bezokolicznik: <strong>{translationResult.infinitive}</strong>
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() =>
                  handleAddFlashcard(
                    translationResult.word,
                    translationResult.translation,
                    translationResult.context,
                    translationResult.partOfSpeech,
                    translationResult.infinitive,
                    translationResult.verbForm,
                    translationResult.verbTense,
                    translationResult.verbPerson,
                    translationResult.grammaticalInfo
                  )
                }
              >
                Dodaj
              </Button>
            </div>

            {translationResult.hasMultipleMeanings &&
              translationResult.alternativeMeanings && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-500 mb-2">
                    Alternatywne znaczenia:
                  </p>
                  <div className="space-y-1">
                    {translationResult.alternativeMeanings.map((meaning, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          handleAddFlashcard(
                            translationResult.word,
                            meaning,
                            undefined,
                            translationResult.partOfSpeech
                          )
                        }
                        className="block text-sm text-primary-600 hover:underline"
                      >
                        + {meaning}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {translationResult.suggestInfinitive &&
              translationResult.infinitive && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-600">
                    To odmieniona forma czasownika. Bezokolicznik:{' '}
                    <strong>{translationResult.infinitive}</strong>
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() =>
                      handleAddFlashcard(
                        translationResult.infinitive!,
                        translationResult.translation,
                        'Bezokolicznik',
                        'verb'
                      )
                    }
                  >
                    Dodaj również bezokolicznik
                  </Button>
                </div>
              )}
          </div>
        )}
      </Card>

      {/* Flashcards list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Fiszki ({set.flashcards.length})
        </h2>

        {set.flashcards.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              Brak fiszek w tym zestawie. Dodaj pierwszą fiszkę powyżej!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {set.flashcards.map((flashcard) => (
              <Card key={flashcard.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {flashcard.word}
                    </p>
                    <p className="text-primary-600">{flashcard.translation}</p>
                    {flashcard.partOfSpeech && (
                      <p className="text-xs text-gray-400 mt-1">
                        {flashcard.partOfSpeech}
                      </p>
                    )}
                    {flashcard.context && (
                      <p className="text-sm text-gray-500 mt-1">
                        {flashcard.context}
                      </p>
                    )}
                    {flashcard.infinitive && (
                      <p className="text-xs text-gray-400 mt-1">
                        Bezokolicznik: {flashcard.infinitive}
                      </p>
                    )}
                    {flashcard.grammaticalInfo && (
                      <p className="text-xs text-blue-500 mt-1 italic">
                        {flashcard.grammaticalInfo}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setFlashcardToDelete(flashcard.id)}
                    className="text-gray-400 hover:text-red-500 ml-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete set modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Usuń zestaw"
      >
        <p className="text-gray-600 mb-4">
          Czy na pewno chcesz usunąć zestaw <strong>{set.name}</strong>? Ta
          operacja jest nieodwracalna i usunie wszystkie fiszki w zestawie.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Anuluj
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteSet}
            loading={deleteLoading}
          >
            Usuń zestaw
          </Button>
        </div>
      </Modal>

      {/* Delete flashcard modal */}
      <Modal
        isOpen={!!flashcardToDelete}
        onClose={() => setFlashcardToDelete(null)}
        title="Usuń fiszkę"
      >
        <p className="text-gray-600 mb-4">
          Czy na pewno chcesz usunąć tę fiszkę?
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => setFlashcardToDelete(null)}
          >
            Anuluj
          </Button>
          <Button
            variant="danger"
            onClick={() => flashcardToDelete && handleDeleteFlashcard(flashcardToDelete)}
          >
            Usuń
          </Button>
        </div>
      </Modal>
    </div>
  )
}
