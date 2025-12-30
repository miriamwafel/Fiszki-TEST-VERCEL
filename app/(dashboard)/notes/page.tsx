'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/Card'

interface StickyNote {
  id: string
  content: string
  color: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', hover: 'hover:bg-yellow-200' },
  { name: 'pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', hover: 'hover:bg-pink-200' },
  { name: 'blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', hover: 'hover:bg-blue-200' },
  { name: 'green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', hover: 'hover:bg-green-200' },
  { name: 'purple', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', hover: 'hover:bg-purple-200' },
]

function getColorClasses(colorName: string) {
  return COLORS.find(c => c.name === colorName) || COLORS[0]
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'przed chwilą'
  if (diffMins < 60) return `${diffMins} min temu`
  if (diffHours < 24) return `${diffHours} godz. temu`
  if (diffDays < 7) return `${diffDays} dni temu`

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export default function NotesPage() {
  const [notes, setNotes] = useState<StickyNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteColor, setNewNoteColor] = useState('yellow')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchNotes()
  }, [])

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes')
      if (res.ok) {
        const data = await res.json()
        setNotes(data)
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNote = async () => {
    if (!newNoteContent.trim() || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent, color: newNoteColor }),
      })

      if (res.ok) {
        const note = await res.json()
        setNotes([note, ...notes])
        setNewNoteContent('')
      }
    } catch (error) {
      console.error('Failed to create note:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const updateNote = async (id: string, updates: Partial<StickyNote>) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (res.ok) {
        const updatedNote = await res.json()
        setNotes(notes.map(n => n.id === id ? updatedNote : n))
      }
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }

  const deleteNote = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę notatkę?')) return

    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotes(notes.filter(n => n.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const togglePin = async (note: StickyNote) => {
    await updateNote(note.id, { pinned: !note.pinned })
    // Reorder: pinned first
    setNotes(prev => {
      const updated = prev.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n)
      return updated.sort((a, b) => {
        if (a.pinned === b.pinned) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        return a.pinned ? -1 : 1
      })
    })
  }

  const startEdit = (note: StickyNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return
    await updateNote(id, { content: editContent })
    setEditingId(null)
    setEditContent('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notatki</h1>
        <p className="text-gray-500 mt-1">Twoje szybkie notatki i przemyślenia</p>
      </div>

      {/* New note form */}
      <Card className="p-4">
        <div className="space-y-3">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Napisz nową notatkę..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                createNote()
              }
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setNewNoteColor(color.name)}
                  className={`w-6 h-6 rounded-full ${color.bg} border-2 ${
                    newNoteColor === color.name
                      ? 'border-gray-600 ring-2 ring-offset-1 ring-gray-400'
                      : 'border-gray-300 hover:border-gray-400'
                  } transition-all`}
                  title={color.name}
                />
              ))}
            </div>
            <button
              onClick={createNote}
              disabled={!newNoteContent.trim() || isCreating}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Zapisuję...' : 'Dodaj notatkę'}
            </button>
          </div>
        </div>
      </Card>

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak notatek</h3>
          <p className="text-gray-500">
            Użyj żółtego przycisku w prawym dolnym rogu lub formularza powyżej, aby dodać pierwszą notatkę.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => {
            const colorClasses = getColorClasses(note.color)
            const isEditing = editingId === note.id

            return (
              <div
                key={note.id}
                className={`relative rounded-xl border-2 ${colorClasses.bg} ${colorClasses.border} p-4 shadow-sm transition-all hover:shadow-md`}
              >
                {/* Pin indicator */}
                {note.pinned && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center shadow">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                    </svg>
                  </div>
                )}

                {/* Content */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className={`w-full px-2 py-1 bg-white bg-opacity-50 rounded border ${colorClasses.border} focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none text-sm ${colorClasses.text}`}
                      rows={4}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          saveEdit(note.id)
                        }
                        if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={() => saveEdit(note.id)}
                        className="px-2 py-1 text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 rounded"
                      >
                        Zapisz
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm ${colorClasses.text} whitespace-pre-wrap break-words`}>
                      {note.content}
                    </p>

                    {/* Footer */}
                    <div className="mt-3 pt-2 border-t border-opacity-30 border-gray-400 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatDate(note.createdAt)}
                      </span>

                      {/* Actions */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => togglePin(note)}
                          className={`p-1 rounded transition-colors ${
                            note.pinned
                              ? 'text-gray-700 hover:text-gray-900'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          title={note.pinned ? 'Odepnij' : 'Przypnij'}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => startEdit(note)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Edytuj"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Usuń"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
