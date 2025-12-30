'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
  { name: 'pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
  { name: 'blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
  { name: 'green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
  { name: 'purple', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
]

export function StickyNotesWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [selectedColor, setSelectedColor] = useState('yellow')
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        if (isOpen && !content.trim()) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, content])

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setContent('')
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleSave = async () => {
    if (!content.trim() || isSaving) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, color: selectedColor }),
      })

      if (res.ok) {
        setContent('')
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          setIsOpen(false)
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Ctrl+Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  const currentColor = COLORS.find(c => c.name === selectedColor) || COLORS[0]

  return (
    <div ref={widgetRef} className="fixed bottom-6 right-6 z-50">
      {/* Success message */}
      {showSuccess && (
        <div className="absolute bottom-full right-0 mb-2 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          Zapisano!
        </div>
      )}

      {/* Quick note panel */}
      {isOpen && !showSuccess && (
        <div
          className={`absolute bottom-full right-0 mb-2 w-72 sm:w-80 rounded-xl shadow-2xl border-2 ${currentColor.bg} ${currentColor.border} overflow-hidden animate-slide-up`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-opacity-30 border-gray-400">
            <span className={`text-sm font-medium ${currentColor.text}`}>Szybka notatka</span>
            <Link
              href="/notes"
              className={`text-xs ${currentColor.text} hover:underline`}
              onClick={() => setIsOpen(false)}
            >
              Zobacz wszystkie
            </Link>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zapisz swoją myśl..."
            className={`w-full px-3 py-2 bg-transparent resize-none focus:outline-none ${currentColor.text} placeholder-opacity-50 text-sm`}
            rows={4}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-opacity-30 border-gray-400">
            {/* Color picker */}
            <div className="flex gap-1">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={`w-5 h-5 rounded-full ${color.bg} border-2 ${
                    selectedColor === color.name
                      ? 'border-gray-600 ring-2 ring-offset-1 ring-gray-400'
                      : 'border-gray-300 hover:border-gray-400'
                  } transition-all`}
                  title={color.name}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setContent('')
                }}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                Anuluj
              </button>
              <button
                onClick={handleSave}
                disabled={!content.trim() || isSaving}
                className="px-3 py-1 text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Zapisuję...' : 'Zapisz'}
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="px-3 py-1 text-xs text-gray-500 text-center border-t border-opacity-20 border-gray-400">
            Ctrl+Enter aby zapisać
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-gray-700 text-white rotate-45'
            : 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 hover:scale-110'
        }`}
        title={isOpen ? 'Zamknij' : 'Szybka notatka'}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  )
}
