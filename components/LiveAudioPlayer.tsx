'use client'

import { useCallback, useRef, useEffect, useState } from 'react'

interface LiveAudioPlayerProps {
  audioQueue: ArrayBuffer[]
  onAudioPlayed: () => void
  sampleRate?: number
}

export function LiveAudioPlayer({
  audioQueue,
  onAudioPlayed,
  sampleRate = 24000, // Gemini zwraca 24kHz
}: LiveAudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const isPlayingRef = useRef(false)
  const queueRef = useRef<ArrayBuffer[]>([])
  const processedCountRef = useRef(0) // Śledź ile elementów już przetworzono
  const [isPlaying, setIsPlaying] = useState(false)

  // Inicjalizacja AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate })
    }
    return audioContextRef.current
  }, [sampleRate])

  // Odtwórz pojedynczy bufor audio
  const playBuffer = useCallback(
    async (buffer: ArrayBuffer): Promise<void> => {
      // Pomiń zbyt małe bufory (prawdopodobnie kontrolne, nie audio)
      if (buffer.byteLength < 100) {
        console.log('Skipping small buffer:', buffer.byteLength, 'bytes')
        return
      }

      // Upewnij się, że długość jest parzysta dla Int16Array
      let audioBuffer = buffer
      if (buffer.byteLength % 2 !== 0) {
        // Przytnij do parzystej długości
        audioBuffer = buffer.slice(0, buffer.byteLength - 1)
        console.log('Trimmed buffer from', buffer.byteLength, 'to', audioBuffer.byteLength)
      }

      if (audioBuffer.byteLength === 0) {
        return
      }

      const audioContext = getAudioContext()

      // Konwertuj PCM 16-bit na Float32
      const int16Array = new Int16Array(audioBuffer)
      const float32Array = new Float32Array(int16Array.length)

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }

      // Utwórz AudioBuffer
      const webAudioBuffer = audioContext.createBuffer(
        1, // mono
        float32Array.length,
        sampleRate
      )
      webAudioBuffer.getChannelData(0).set(float32Array)

      // Odtwórz
      const source = audioContext.createBufferSource()
      source.buffer = webAudioBuffer
      source.connect(audioContext.destination)

      return new Promise((resolve) => {
        source.onended = () => {
          resolve()
        }
        source.start()
      })
    },
    [getAudioContext, sampleRate]
  )

  // Przetwarzaj kolejkę audio
  const processQueue = useCallback(async () => {
    if (isPlayingRef.current) return
    if (queueRef.current.length === 0) {
      setIsPlaying(false)
      return
    }

    isPlayingRef.current = true
    setIsPlaying(true)

    while (queueRef.current.length > 0) {
      const buffer = queueRef.current.shift()
      if (buffer) {
        try {
          await playBuffer(buffer)
        } catch (error) {
          console.error('Error playing audio:', error)
        }
      }
    }

    isPlayingRef.current = false
    setIsPlaying(false)
    onAudioPlayed()
  }, [playBuffer, onAudioPlayed])

  // Dodaj nowe audio do kolejki (tylko nowe elementy)
  useEffect(() => {
    // Dodaj tylko elementy które jeszcze nie były przetworzone
    const newItems = audioQueue.slice(processedCountRef.current)
    if (newItems.length > 0) {
      console.log('Adding', newItems.length, 'new audio items to queue')
      queueRef.current.push(...newItems)
      processedCountRef.current = audioQueue.length
      processQueue()
    }
  }, [audioQueue, processQueue])

  // Reset processedCount gdy audioQueue jest wyczyszczone
  useEffect(() => {
    if (audioQueue.length === 0) {
      processedCountRef.current = 0
    }
  }, [audioQueue.length])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return (
    <div className="flex items-center justify-center">
      {isPlaying && (
        <div className="flex items-center gap-2 text-primary-600">
          <div className="flex gap-1">
            <span
              className="w-1 h-4 bg-primary-500 rounded animate-pulse"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1 h-6 bg-primary-500 rounded animate-pulse"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1 h-4 bg-primary-500 rounded animate-pulse"
              style={{ animationDelay: '300ms' }}
            />
            <span
              className="w-1 h-5 bg-primary-500 rounded animate-pulse"
              style={{ animationDelay: '450ms' }}
            />
            <span
              className="w-1 h-3 bg-primary-500 rounded animate-pulse"
              style={{ animationDelay: '600ms' }}
            />
          </div>
          <span className="text-sm font-medium">Nauczyciel mówi...</span>
        </div>
      )}
    </div>
  )
}
