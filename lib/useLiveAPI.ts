'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// Typy dla Gemini Live API
interface LiveAPIConfig {
  model: string
  systemInstruction?: string
  apiKey: string
}

interface ServerMessage {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }
    turnComplete?: boolean
  }
  setupComplete?: boolean
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface UseLiveAPIReturn {
  connect: () => Promise<void>
  disconnect: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  sendText: (text: string) => void
  connectionState: ConnectionState
  currentText: string
  audioQueue: ArrayBuffer[]
  clearAudioQueue: () => void
  isModelSpeaking: boolean
}

export function useLiveAPI(config: LiveAPIConfig): UseLiveAPIReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [currentText, setCurrentText] = useState('')
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([])
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const setupCompleteRef = useRef(false)

  // Konwersja base64 na ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }, [])

  // Konwersja ArrayBuffer na base64
  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }, [])

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState('connecting')
    setupCompleteRef.current = false

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${config.apiKey}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected, sending setup...')

      // Wyślij konfigurację zgodnie z dokumentacją Google
      const setupMessage = {
        setup: {
          model: config.model,
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
          systemInstruction: config.systemInstruction ? {
            parts: [{ text: config.systemInstruction }]
          } : undefined
        }
      }

      ws.send(JSON.stringify(setupMessage))
    }

    ws.onmessage = async (event) => {
      try {
        // Obsłuż dane binarne (audio) - Blob
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer()
          console.log('Received audio blob:', arrayBuffer.byteLength, 'bytes')
          setIsModelSpeaking(true)
          setAudioQueue(prev => [...prev, arrayBuffer])
          return
        }

        // Obsłuż JSON
        const message: ServerMessage = JSON.parse(event.data)
        console.log('Received JSON message:', message)

        if (message.setupComplete) {
          console.log('Setup complete!')
          setupCompleteRef.current = true
          setConnectionState('connected')
          return
        }

        if (message.serverContent) {
          const { modelTurn, turnComplete } = message.serverContent

          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              // Tekst
              if (part.text) {
                setCurrentText(prev => prev + part.text)
              }

              // Audio w formacie base64
              if (part.inlineData?.mimeType.startsWith('audio/')) {
                setIsModelSpeaking(true)
                const audioBuffer = base64ToArrayBuffer(part.inlineData.data)
                setAudioQueue(prev => [...prev, audioBuffer])
              }
            }
          }

          if (turnComplete) {
            console.log('Turn complete')
            setIsModelSpeaking(false)
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error, typeof event.data)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionState('error')
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      // Nie ustawiaj disconnected jeśli był error - żeby nie próbować reconnect
      if (connectionState !== 'error') {
        setConnectionState('error') // Ustaw error zamiast disconnected żeby zatrzymać reconnect
      }
      setupCompleteRef.current = false
    }
  }, [config, base64ToArrayBuffer, connectionState])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionState('disconnected')
    setCurrentText('')
    setAudioQueue([])
    setIsModelSpeaking(false)
  }, [])

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !setupCompleteRef.current) {
      console.warn('Cannot send audio: not connected')
      return
    }

    const message = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: arrayBufferToBase64(audioData)
        }]
      }
    }

    wsRef.current.send(JSON.stringify(message))
  }, [arrayBufferToBase64])

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !setupCompleteRef.current) {
      console.warn('Cannot send text: not connected')
      return
    }

    setCurrentText('')

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      }
    }

    wsRef.current.send(JSON.stringify(message))
  }, [])

  const clearAudioQueue = useCallback(() => {
    setAudioQueue([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return {
    connect,
    disconnect,
    sendAudio,
    sendText,
    connectionState,
    currentText,
    audioQueue,
    clearAudioQueue,
    isModelSpeaking
  }
}
