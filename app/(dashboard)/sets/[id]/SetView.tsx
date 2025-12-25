'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'

const translationMessages = [
  'AI analizuje słowo...',
  'Szukamy najlepszego tłumaczenia...',
  'Sprawdzamy kontekst użycia...',
]

function TranslationLoader({ isLoading }: { isLoading: boolean }) {
  const [message, setMessage] = useState(translationMessages[0])
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (!isLoading) return

    const msgInterval = setInterval(() => {
      setMessage(translationMessages[Math.floor(Math.random() * translationMessages.length)])
    }, 2000)

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => {
      clearInterval(msgInterval)
      clearInterval(dotsInterval)
    }
  }, [isLoading])

  if (!isLoading) return null

  return (
    <div className="mt-4 p-4 bg-primary-50 rounded-lg flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-primary-200 rounded-full animate-spin border-t-primary-600" />
      <span className="text-primary-700">{message}{dots}</span>
    </div>
  )
}

interface Flashcard {
  id: string
  word: string
  translation: string
  context?: string | null
  partOfSpeech?: string | null
  infinitive?: string | null
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
  const [flashcardToEdit, setFlashcardToEdit] = useState<Flashcard | null>(null)
  const [editForm, setEditForm] = useState({
    word: '',
    translation: '',
    context: '',
    partOfSpeech: '',
  })
  const [editLoading, setEditLoading] = useState(false)

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
    infinitive?: string
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

  const startEditFlashcard = (flashcard: Flashcard) => {
    setFlashcardToEdit(flashcard)
    setEditForm({
      word: flashcard.word,
      translation: flashcard.translation,
      context: flashcard.context || '',
      partOfSpeech: flashcard.partOfSpeech || '',
    })
  }

  const handleEditFlashcard = async () => {
    if (!flashcardToEdit) return

    setEditLoading(true)
    try {
      const response = await fetch(`/api/flashcards/${flashcardToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: editForm.word.trim(),
          translation: editForm.translation.trim(),
          context: editForm.context.trim() || null,
          partOfSpeech: editForm.partOfSpeech.trim() || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update flashcard')
      }

      const updatedFlashcard = await response.json()

      setSet((prev) => ({
        ...prev,
        flashcards: prev.flashcards.map((f) =>
          f.id === flashcardToEdit.id ? updatedFlashcard : f
        ),
      }))
      setFlashcardToEdit(null)
    } catch (error) {
      console.error('Edit flashcard error:', error)
      alert('Wystąpił błąd podczas edycji fiszki')
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4">
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
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {set.flashcards.length > 0 && (
            <>
              <Link href={`/sets/${set.id}/practice`} className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full sm:w-auto text-sm">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2"
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
                  <span className="hidden sm:inline">Powtórka</span>
                  <span className="sm:hidden">↻</span>
                </Button>
              </Link>
              <Link href="/exercises" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full sm:w-auto text-sm">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Ćwiczenia</span>
                  <span className="sm:hidden">✓</span>
                </Button>
              </Link>
              <Link href={`/sets/${set.id}/tutor`} className="flex-1 sm:flex-none">
                <Button className="w-full sm:w-auto text-sm">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Rozmowa AI</span>
                  <span className="sm:hidden">🎤</span>
                </Button>
              </Link>
            </>
          )}
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} className="text-sm">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
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
            <span className="hidden sm:inline ml-2">Usuń</span>
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

        <TranslationLoader isLoading={loading} />

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
              </div>
              <Button
                size="sm"
                onClick={() =>
                  handleAddFlashcard(
                    translationResult.word,
                    translationResult.translation,
                    translationResult.context,
                    translationResult.partOfSpeech,
                    translationResult.infinitive
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
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => startEditFlashcard(flashcard)}
                      className="text-gray-400 hover:text-primary-600 p-1"
                      title="Edytuj"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setFlashcardToDelete(flashcard.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Usuń"
                    >
                      <svg
                        className="w-4 h-4"
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

      {/* Edit flashcard modal */}
      <Modal
        isOpen={!!flashcardToEdit}
        onClose={() => setFlashcardToEdit(null)}
        title="Edytuj fiszkę"
      >
        <div className="space-y-4">
          <Input
            id="edit-word"
            label="Słowo"
            value={editForm.word}
            onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
          />
          <Input
            id="edit-translation"
            label="Tłumaczenie"
            value={editForm.translation}
            onChange={(e) => setEditForm({ ...editForm, translation: e.target.value })}
          />
          <Input
            id="edit-context"
            label="Kontekst (opcjonalnie)"
            value={editForm.context}
            onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
          />
          <Input
            id="edit-partOfSpeech"
            label="Część mowy (opcjonalnie)"
            value={editForm.partOfSpeech}
            onChange={(e) => setEditForm({ ...editForm, partOfSpeech: e.target.value })}
          />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setFlashcardToEdit(null)}>
              Anuluj
            </Button>
            <Button
              onClick={handleEditFlashcard}
              loading={editLoading}
              disabled={!editForm.word.trim() || !editForm.translation.trim()}
            >
              Zapisz
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
