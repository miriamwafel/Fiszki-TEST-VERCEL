'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface PageContext {
  pathname: string
  pageTitle: string
  selectedText?: string
  exerciseContext?: {
    word?: string
    translation?: string
    sentence?: string
  }
}

// Custom event for opening AI chat with a question
export interface OpenAIChatEvent {
  question: string
  context?: {
    word?: string
    translation?: string
    sentence?: string
  }
}

// Helper function to open AI chat from anywhere
export function openAIChat(question: string, context?: OpenAIChatEvent['context']) {
  const event = new CustomEvent('openAIChat', {
    detail: { question, context }
  })
  window.dispatchEvent(event)
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showSelectedText, setShowSelectedText] = useState(false)
  const [exerciseContext, setExerciseContext] = useState<PageContext['exerciseContext']>()
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const pathname = usePathname()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const lastUserMessageRef = useRef<HTMLDivElement>(null)

  // Scroll to last user message when user sends a message
  const scrollToUserMessage = useCallback(() => {
    if (lastUserMessageRef.current && chatContainerRef.current) {
      const container = chatContainerRef.current
      const userMessage = lastUserMessageRef.current
      const messageTop = userMessage.offsetTop - 16 // Small padding
      container.scrollTop = messageTop
    }
  }, [])

  // Smooth scroll during streaming
  useEffect(() => {
    if (isStreaming && chatContainerRef.current) {
      const container = chatContainerRef.current
      // Scroll down slowly as content streams in
      const scrollInterval = setInterval(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight - 50) {
          container.scrollTop += 20
        }
      }, 100)
      return () => clearInterval(scrollInterval)
    }
  }, [isStreaming, streamingContent])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Listen for text selection on the page
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      if (text && text.length > 0 && text.length < 500) {
        setSelectedText(text)
        setShowSelectedText(true)
      }
    }

    const handleMouseUp = () => {
      // Small delay to ensure selection is complete
      setTimeout(handleSelectionChange, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Listen for custom open events (from exercises, stories, etc.)
  useEffect(() => {
    const handleOpenAIChat = (e: CustomEvent<OpenAIChatEvent>) => {
      const { question, context } = e.detail
      setIsOpen(true)
      setInputValue(question)
      if (context) {
        setExerciseContext(context)
      }
      // Auto-focus and optionally auto-send
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }

    window.addEventListener('openAIChat', handleOpenAIChat as EventListener)
    return () => window.removeEventListener('openAIChat', handleOpenAIChat as EventListener)
  }, [])

  // Get page context for AI
  const getPageContext = useCallback((): PageContext => {
    const pageTitle = document.title || 'Fiszki'

    // Determine context based on pathname
    let contextDescription = ''
    if (pathname.includes('/stories')) {
      contextDescription = 'Użytkownik przegląda historyjki do nauki języków.'
    } else if (pathname.includes('/exercises')) {
      contextDescription = 'Użytkownik wykonuje ćwiczenia językowe (uzupełnianie luk lub układanie zdań).'
    } else if (pathname.includes('/practice')) {
      contextDescription = 'Użytkownik ćwiczy fiszki w trybie powtórek.'
    } else if (pathname.includes('/sets')) {
      contextDescription = 'Użytkownik przegląda lub edytuje zestawy fiszek.'
    } else if (pathname.includes('/grammar')) {
      contextDescription = 'Użytkownik uczy się gramatyki.'
    } else if (pathname.includes('/tutor')) {
      contextDescription = 'Użytkownik rozmawia z AI tutorem.'
    } else if (pathname.includes('/dashboard')) {
      contextDescription = 'Użytkownik jest na stronie głównej dashboardu.'
    }

    return {
      pathname,
      pageTitle: contextDescription || pageTitle,
      selectedText: showSelectedText ? selectedText : undefined,
      exerciseContext,
    }
  }, [pathname, selectedText, showSelectedText, exerciseContext])

  // Simulate typing effect
  const simulateTyping = useCallback((fullText: string) => {
    setIsStreaming(true)
    setStreamingContent('')

    let currentIndex = 0
    const charsPerTick = 3 // Characters to add per interval
    const intervalMs = 20 // Milliseconds between additions

    const typeInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        const nextIndex = Math.min(currentIndex + charsPerTick, fullText.length)
        setStreamingContent(fullText.slice(0, nextIndex))
        currentIndex = nextIndex
      } else {
        clearInterval(typeInterval)
        // Add the complete message to messages array
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
        setStreamingContent('')
        setIsStreaming(false)
      }
    }, intervalMs)

    return () => clearInterval(typeInterval)
  }, [])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return

    const userMessage = inputValue.trim()
    const context = getPageContext()

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newUserMessage])
    setInputValue('')
    setShowSelectedText(false)
    setExerciseContext(undefined)
    setIsLoading(true)

    // Scroll to user message after a short delay
    setTimeout(scrollToUserMessage, 50)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      setIsLoading(false)

      // Start typing effect
      simulateTyping(data.response)
    } catch (error) {
      console.error('AI Chat error:', error)
      setIsLoading(false)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Przepraszam, wystąpił błąd. Spróbuj ponownie.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const useSelectedText = () => {
    if (selectedText) {
      setInputValue(prev =>
        prev
          ? `${prev}\n\n"${selectedText}"`
          : `Co oznacza: "${selectedText}"?`
      )
      setShowSelectedText(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div ref={widgetRef} className="fixed bottom-6 left-6 z-50">
      {/* Chat panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 h-[500px] max-h-[70vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="font-medium">Asystent AI</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  title="Wyczyść czat"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Selected text indicator */}
          {showSelectedText && selectedText && (
            <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <span className="text-xs text-indigo-600 flex-1 truncate">
                Zaznaczono: "{selectedText.slice(0, 50)}{selectedText.length > 50 ? '...' : ''}"
              </span>
              <button
                onClick={useSelectedText}
                className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
              >
                Zapytaj
              </button>
              <button
                onClick={() => setShowSelectedText(false)}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm font-medium mb-1">Witaj! Jestem Twoim asystentem AI.</p>
                <p className="text-xs text-gray-400">
                  Zapytaj mnie o słówka, gramatykę lub cokolwiek związanego z nauką języków.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Możesz też zaznaczyć tekst na stronie, a ja pomogę Ci go zrozumieć.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isLastUserMessage = message.role === 'user' &&
                  index === messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop()

                return (
                  <div
                    key={index}
                    ref={isLastUserMessage ? lastUserMessageRef : null}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {/* Streaming content - typing effect */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3 py-2 bg-gray-100 text-gray-800">
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* Loading dots - waiting for API */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Napisz wiadomość..."
                className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '38px', maxHeight: '100px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading || isStreaming}
                className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Enter aby wysłać, Shift+Enter dla nowej linii
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-gray-700 text-white rotate-0'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:scale-110 hover:shadow-xl'
        }`}
        title={isOpen ? 'Zamknij asystenta' : 'Otwórz asystenta AI'}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>
  )
}
