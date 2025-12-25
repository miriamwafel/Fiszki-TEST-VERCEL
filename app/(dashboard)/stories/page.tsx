'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'

// Loading messages for AI generation
const storyLoadingMessages = [
  'AI pisze historię dla Ciebie...',
  'Tworzymy angażującą fabułę...',
  'Dobieramy słownictwo do poziomu...',
  'Generujemy spersonalizowaną treść...',
]

const wordLoadingMessages = [
  'AI analizuje słowo...',
  'Sprawdzamy kontekst zdania...',
  'Rozpoznajemy formę gramatyczną...',
]

function AILoadingOverlay({ messages, isGenerating }: { messages: string[], isGenerating: boolean }) {
  const [currentMessage, setCurrentMessage] = useState(messages[0])
  const [dots, setDots] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0)
      return
    }

    const messageInterval = setInterval(() => {
      setCurrentMessage(messages[Math.floor(Math.random() * messages.length)])
    }, 2500)

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    // Symulowany postęp: szybki start, potem wolniejszy
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev // Zatrzymaj na 90% i czekaj na odpowiedź
        if (prev < 30) return prev + 3 // Szybki start
        if (prev < 60) return prev + 2 // Średnie tempo
        return prev + 1 // Wolne tempo na końcu
      })
    }, 200)

    return () => {
      clearInterval(messageInterval)
      clearInterval(dotsInterval)
      clearInterval(progressInterval)
    }
  }, [isGenerating, messages])

  if (!isGenerating) return null

  return (
    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
      <div className="relative mb-4">
        <div className="w-12 h-12 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <p className="text-gray-600 font-medium mb-3">{currentMessage}{dots}</p>
      <div className="w-64 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary-600 h-full transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-2">{progress}%</p>
    </div>
  )
}

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

  const [wordModal, setWordModal] = useState<{
    word: string
    translation: string
    partOfSpeech?: string
    context?: string
    infinitive?: string
    infinitiveTranslation?: string
    tenseInfo?: string
    suggestInfinitive?: boolean
    phrase?: string
    phraseTranslation?: string
  } | null>(null)
  const [selectedSet, setSelectedSet] = useState('')
  const [addingToSet, setAddingToSet] = useState(false)
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null)
  const [deletingStory, setDeletingStory] = useState(false)
  const [translatingWord, setTranslatingWord] = useState(false)
  const [topic, setTopic] = useState('')
  const [showNewSetModal, setShowNewSetModal] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [newSetLanguage, setNewSetLanguage] = useState('')
  const [creatingSet, setCreatingSet] = useState(false)

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

  const getSentenceContext = (content: string, word: string): string => {
    // Find the sentence containing the word
    const sentences = content.split(/(?<=[.!?])\s+/)
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(word.toLowerCase())) {
        return sentence.trim()
      }
    }
    return ''
  }

  const handleWordClick = async (word: string) => {
    // Clean the word from punctuation
    const cleanWord = word.replace(/[.,!?;:"'()[\]{}]/g, '').trim()
    if (!cleanWord) return

    // Get sentence context from the story
    const sentenceContext = selectedStory
      ? getSentenceContext(selectedStory.content, cleanWord)
      : ''

    setTranslatingWord(true)
    try {
      const response = await fetch('/api/translate-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: cleanWord,
          fromLanguage: selectedStory?.language || language,
          sentenceContext,
          storyId: selectedStory?.id, // Przekaż storyId dla cache
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
        infinitiveTranslation: data.infinitiveTranslation,
        tenseInfo: data.tenseInfo,
        suggestInfinitive: data.suggestInfinitive,
        phrase: data.phrase,
        phraseTranslation: data.phraseTranslation,
      })
    } catch (error) {
      console.error('Failed to translate word:', error)
      alert('Nie udało się przetłumaczyć słowa')
    } finally {
      setTranslatingWord(false)
    }
  }

  const handleAddToSet = async (mode: 'word' | 'infinitive' | 'phrase' = 'word') => {
    if (!selectedSet || !wordModal) return

    setAddingToSet(true)
    try {
      let wordToAdd: string
      let translationToAdd: string
      let contextToAdd: string | undefined

      if (mode === 'infinitive' && wordModal.infinitive) {
        wordToAdd = wordModal.infinitive
        translationToAdd = wordModal.infinitiveTranslation || wordModal.translation
        contextToAdd = 'Bezokolicznik'
      } else if (mode === 'phrase' && wordModal.phrase) {
        wordToAdd = wordModal.phrase
        translationToAdd = wordModal.phraseTranslation || ''
        contextToAdd = 'Fraza/wyrażenie'
      } else {
        wordToAdd = wordModal.word
        translationToAdd = wordModal.translation
        contextToAdd = wordModal.context
      }

      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: selectedSet,
          word: wordToAdd,
          translation: translationToAdd,
          context: contextToAdd,
          partOfSpeech: mode === 'phrase' ? 'phrase' : wordModal.partOfSpeech,
          infinitive: mode === 'word' ? wordModal.infinitive : null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add flashcard')
      }

      setWordModal(null)
    } catch (error) {
      console.error('Failed to add flashcard:', error)
      alert('Nie udało się dodać fiszki')
    } finally {
      setAddingToSet(false)
    }
  }

  const handleCreateSet = async () => {
    if (!newSetName.trim() || !newSetLanguage) return

    setCreatingSet(true)
    try {
      const response = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSetName.trim(),
          language: newSetLanguage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setSets((prev) => [data, ...prev])
      setSelectedSet(data.id)
      setShowNewSetModal(false)
      setNewSetName('')
      setNewSetLanguage('')
    } catch (error) {
      console.error('Failed to create set:', error)
      alert('Nie udało się utworzyć zestawu')
    } finally {
      setCreatingSet(false)
    }
  }

  const handleDeleteStory = async (id: string) => {
    setDeletingStory(true)
    try {
      const response = await fetch(`/api/stories/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete story')
      }

      setStories((prev) => prev.filter((s) => s.id !== id))
      if (selectedStory?.id === id) {
        setSelectedStory(null)
      }
      setStoryToDelete(null)
    } catch (error) {
      console.error('Failed to delete story:', error)
      alert('Nie udało się usunąć historii')
    } finally {
      setDeletingStory(false)
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
              label="Temat (opcjonalnie)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="np. podróże, jedzenie, praca..."
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
                  <div
                    key={story.id}
                    className={`relative group p-3 rounded-lg text-sm transition-colors ${
                      selectedStory?.id === story.id
                        ? 'bg-primary-50 border border-primary-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedStory(story)}
                      className="w-full text-left"
                    >
                      <p className="font-medium text-gray-900 truncate pr-6">
                        {story.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {story.difficulty} · {story.wordCount} słów
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setStoryToDelete(story.id)
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Usuń historię"
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
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Story display */}
        <Card className="p-6 lg:col-span-2 relative">
          <AILoadingOverlay messages={storyLoadingMessages} isGenerating={generating} />
          <AILoadingOverlay messages={wordLoadingMessages} isGenerating={translatingWord} />
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
              <p className="font-semibold text-gray-900 text-lg">
                {wordModal.word}
              </p>
              <p className="text-primary-600 text-lg">{wordModal.translation}</p>
              {wordModal.partOfSpeech && (
                <p className="text-sm text-gray-500 mt-1">
                  ({wordModal.partOfSpeech})
                </p>
              )}
              {wordModal.context && (
                <p className="text-sm text-gray-600 mt-2 italic">
                  {wordModal.context}
                </p>
              )}
            </div>

            {/* Verb conjugation info */}
            {wordModal.suggestInfinitive && wordModal.infinitive && wordModal.tenseInfo && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-1">
                  To odmieniona forma czasownika
                </p>
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Czas/forma:</span> {wordModal.tenseInfo}
                </p>
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Bezokolicznik:</span>{' '}
                  <span className="font-semibold">{wordModal.infinitive}</span>
                  {wordModal.infinitiveTranslation && (
                    <span className="text-blue-600"> → {wordModal.infinitiveTranslation}</span>
                  )}
                </p>
              </div>
            )}

            {/* Phrase info */}
            {wordModal.phrase && wordModal.phraseTranslation && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800 font-medium mb-1">
                  Wykryto wyrażenie/frazę
                </p>
                <p className="text-sm text-purple-700">
                  <span className="font-semibold">{wordModal.phrase}</span>
                  <span className="text-purple-600"> → {wordModal.phraseTranslation}</span>
                </p>
              </div>
            )}

            {sets.length > 0 ? (
              <>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
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
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNewSetLanguage(selectedStory?.language || language)
                      setShowNewSetModal(true)
                    }}
                    className="mb-0 shrink-0"
                  >
                    + Nowy
                  </Button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {wordModal.phrase && wordModal.phraseTranslation && (
                    <Button
                      onClick={() => handleAddToSet('phrase')}
                      disabled={!selectedSet}
                      loading={addingToSet}
                      className="w-full"
                    >
                      Dodaj frazę "{wordModal.phrase}"
                    </Button>
                  )}
                  {wordModal.suggestInfinitive && wordModal.infinitive && (
                    <Button
                      onClick={() => handleAddToSet('infinitive')}
                      disabled={!selectedSet}
                      loading={addingToSet}
                      className="w-full"
                      variant={wordModal.phrase ? 'secondary' : 'primary'}
                    >
                      Dodaj bezokolicznik ({wordModal.infinitive})
                    </Button>
                  )}
                  <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={() => setWordModal(null)}>
                      Anuluj
                    </Button>
                    <Button
                      onClick={() => handleAddToSet('word')}
                      disabled={!selectedSet}
                      loading={addingToSet}
                      variant={(wordModal.suggestInfinitive || wordModal.phrase) ? 'secondary' : 'primary'}
                    >
                      Dodaj "{wordModal.word}"
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">
                  Nie masz jeszcze żadnych zestawów.
                </p>
                <Button
                  onClick={() => {
                    setNewSetLanguage(selectedStory?.language || language)
                    setShowNewSetModal(true)
                  }}
                >
                  Utwórz pierwszy zestaw
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete story modal */}
      <Modal
        isOpen={!!storyToDelete}
        onClose={() => setStoryToDelete(null)}
        title="Usuń historię"
      >
        <p className="text-gray-600 mb-4">
          Czy na pewno chcesz usunąć tę historię? Ta operacja jest nieodwracalna.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setStoryToDelete(null)}>
            Anuluj
          </Button>
          <Button
            variant="danger"
            onClick={() => storyToDelete && handleDeleteStory(storyToDelete)}
            loading={deletingStory}
          >
            Usuń
          </Button>
        </div>
      </Modal>

      {/* New set modal */}
      <Modal
        isOpen={showNewSetModal}
        onClose={() => setShowNewSetModal(false)}
        title="Utwórz nowy zestaw"
      >
        <div className="space-y-4">
          <Input
            id="newSetName"
            label="Nazwa zestawu"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            placeholder="np. Podróże, Biznes, Codzienne..."
          />
          <Select
            id="newSetLanguage"
            label="Język"
            value={newSetLanguage}
            onChange={(e) => setNewSetLanguage(e.target.value)}
            options={[
              { value: '', label: 'Wybierz język...' },
              ...languages,
            ]}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowNewSetModal(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleCreateSet}
              loading={creatingSet}
              disabled={!newSetName.trim() || !newSetLanguage}
            >
              Utwórz zestaw
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
