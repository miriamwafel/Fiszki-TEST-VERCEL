'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'

interface Story {
  id: string
  title: string
  content: string
  language: string
  difficulty: string
  wordCount: number
  createdAt: string
  vocabulary?: { word: string; translation: string }[]
}

interface FlashcardSet {
  id: string
  name: string
  language: string
}

const languages = [
  { value: 'en', label: 'Angielski' },
  { value: 'de', label: 'Niemiecki' },
  { value: 'es', label: 'Hiszpański' },
  { value: 'fr', label: 'Francuski' },
  { value: 'it', label: 'Włoski' },
]

const difficulties = [
  { value: 'A1', label: 'A1 - Początkujący' },
  { value: 'A2', label: 'A2 - Podstawowy' },
  { value: 'B1', label: 'B1 - Średnio zaawansowany' },
  { value: 'B2', label: 'B2 - Zaawansowany' },
  { value: 'C1', label: 'C1 - Biegły' },
  { value: 'C2', label: 'C2 - Native' },
]

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [language, setLanguage] = useState('en')
  const [difficulty, setDifficulty] = useState('A2')
  const [wordCount, setWordCount] = useState('100')
  const [topic, setTopic] = useState('')

  interface WordModalData {
    word: string
    translation: string
    partOfSpeech?: string
    context?: string
    infinitive?: string
    suggestInfinitive?: boolean
  }

  const [wordModal, setWordModal] = useState<WordModalData | null>(null)
  const [selectedSet, setSelectedSet] = useState('')
  const [addingToSet, setAddingToSet] = useState(false)

  useEffect(() => {
    fetchStories()
    fetchSets()
  }, [])

  const fetchStories = async () => {
    try {
      const response = await fetch('/api/stories')
      const data = await response.json()
      setStories(data)
    } catch (error) {
      console.error('Failed to fetch stories:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSets = async () => {
    try {
      const response = await fetch('/api/sets')
      const data = await response.json()
      setSets(data)
    } catch (error) {
      console.error('Failed to fetch sets:', error)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          difficulty,
          wordCount: parseInt(wordCount),
          topic: topic.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSelectedStory(data)
      setStories((prev) => [data, ...prev])
    } catch (error) {
      console.error('Failed to generate story:', error)
      alert('Wystąpił błąd podczas generowania historii')
    } finally {
      setGenerating(false)
    }
  }

  const handleWordClick = async (word: string) => {
    // Clean the word from punctuation
    const cleanWord = word.replace(/[.,!?;:"'()[\]{}]/g, '').trim()
    if (!cleanWord) return

    try {
      const response = await fetch('/api/translate-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: cleanWord,
          fromLanguage: selectedStory?.language || language,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setWordModal({
        word: cleanWord,
        translation: data.translation,
        partOfSpeech: data.partOfSpeech,
        context: data.context,
        infinitive: data.infinitive,
        suggestInfinitive: data.suggestInfinitive,
      })
    } catch (error) {
      console.error('Failed to translate word:', error)
      alert('Nie udało się przetłumaczyć słowa')
    }
  }

  const handleAddToSet = async (useInfinitive = false) => {
    if (!selectedSet || !wordModal) return

    const wordToAdd = useInfinitive && wordModal.infinitive ? wordModal.infinitive : wordModal.word

    setAddingToSet(true)
    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: selectedSet,
          word: wordToAdd,
          translation: wordModal.translation,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add flashcard')
      }

      alert('Dodano do zestawu!')
      if (!useInfinitive) {
        setWordModal(null)
      }
    } catch (error) {
      console.error('Failed to add flashcard:', error)
      alert('Nie udało się dodać fiszki')
    } finally {
      setAddingToSet(false)
    }
  }

  const renderStoryContent = (content: string) => {
    const words = content.split(/(\s+)/)
    return words.map((word, index) => {
      if (/^\s+$/.test(word)) {
        return word
      }
      return (
        <span
          key={index}
          className="story-word"
          onClick={() => handleWordClick(word)}
        >
          {word}
        </span>
      )
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Generator historyjek</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator panel */}
        <Card className="p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Wygeneruj nową historię
          </h2>

          <div className="space-y-4">
            <Select
              id="language"
              label="Język"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={languages}
            />

            <Select
              id="difficulty"
              label="Poziom trudności"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              options={difficulties}
            />

            <Input
              id="wordCount"
              type="number"
              label="Liczba słów (około)"
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
              min="50"
              max="500"
            />

            <Input
              id="topic"
              type="text"
              label="Temat historii (opcjonalnie)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="np. podróże, gotowanie, technologia..."
            />

            <Button
              onClick={handleGenerate}
              loading={generating}
              className="w-full"
            >
              Generuj historię
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Poprzednie historie
            </h3>
            {loading ? (
              <p className="text-sm text-gray-500">Ładowanie...</p>
            ) : stories.length === 0 ? (
              <p className="text-sm text-gray-500">Brak historii</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setSelectedStory(story)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                      selectedStory?.id === story.id
                        ? 'bg-primary-50 border border-primary-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-gray-900 truncate">
                      {story.title}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {story.difficulty} · {story.wordCount} słów
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Story display */}
        <Card className="p-6 lg:col-span-2">
          {selectedStory ? (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedStory.title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedStory.difficulty} · {selectedStory.wordCount} słów
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {selectedStory.language.toUpperCase()}
                </span>
              </div>

              <div className="prose max-w-none mb-6">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {renderStoryContent(selectedStory.content)}
                </p>
              </div>

              <p className="text-sm text-gray-500 italic">
                Kliknij na słowo, aby zobaczyć tłumaczenie i dodać do zestawu fiszek.
              </p>

              {selectedStory.vocabulary && selectedStory.vocabulary.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Słownictwo z historii
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedStory.vocabulary.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => setWordModal(item)}
                        className="text-left p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <p className="font-medium text-gray-900 text-sm">
                          {item.word}
                        </p>
                        <p className="text-gray-500 text-xs">{item.translation}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Brak wybranej historii
              </h3>
              <p className="text-gray-500">
                Wygeneruj nową historię lub wybierz z listy poprzednich.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Word modal */}
      <Modal
        isOpen={!!wordModal}
        onClose={() => setWordModal(null)}
        title="Dodaj do zestawu"
      >
        {wordModal && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-gray-900 text-lg">
                  {wordModal.word}
                </p>
                {wordModal.partOfSpeech && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {wordModal.partOfSpeech}
                  </span>
                )}
              </div>
              <p className="text-primary-600 font-medium mb-2">{wordModal.translation}</p>

              {wordModal.infinitive && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Forma podstawowa (bezokolicznik):</span>{' '}
                    {wordModal.infinitive}
                  </p>
                </div>
              )}

              {wordModal.context && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Kontekst użycia:</span>{' '}
                    {wordModal.context}
                  </p>
                </div>
              )}
            </div>

            {sets.length > 0 ? (
              <>
                <Select
                  id="set"
                  label="Wybierz zestaw"
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value)}
                  options={[
                    { value: '', label: 'Wybierz zestaw...' },
                    ...sets.map((set) => ({
                      value: set.id,
                      label: `${set.name} (${set.language.toUpperCase()})`,
                    })),
                  ]}
                />

                <div className="mt-4 flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => setWordModal(null)}>
                    Anuluj
                  </Button>
                  <Button
                    onClick={() => handleAddToSet(false)}
                    disabled={!selectedSet}
                    loading={addingToSet}
                  >
                    Dodaj to słowo
                  </Button>
                  {wordModal.suggestInfinitive && wordModal.infinitive && (
                    <Button
                      onClick={() => handleAddToSet(true)}
                      disabled={!selectedSet}
                      loading={addingToSet}
                      variant="secondary"
                    >
                      Dodaj bezokolicznik
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm">
                Nie masz jeszcze żadnych zestawów. Utwórz zestaw, aby móc dodawać słówka.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
