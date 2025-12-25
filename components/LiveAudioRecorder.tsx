'use client'

import { useCallback, useRef, useState, useEffect } from 'react'

interface LiveAudioRecorderProps {
  onAudioData: (data: ArrayBuffer) => void
  isRecording: boolean
  onRecordingChange: (recording: boolean) => void
  disabled?: boolean
}

// Funkcja do resamplingu audio z dowolnego sample rate do 16kHz
function resampleTo16kHz(inputBuffer: Float32Array, inputSampleRate: number): Int16Array {
  const targetSampleRate = 16000
  const ratio = inputSampleRate / targetSampleRate
  const outputLength = Math.floor(inputBuffer.length / ratio)
  const output = new Int16Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio)
    // Clamp do zakresu [-1, 1] i skaluj do Int16
    const sample = Math.max(-1, Math.min(1, inputBuffer[srcIndex]))
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

export function LiveAudioRecorder({
  onAudioData,
  isRecording,
  onRecordingChange,
  disabled = false,
}: LiveAudioRecorderProps) {
  const [isSupported, setIsSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Sprawdź wsparcie i czy to mobile
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false)
    }
    // Wykryj mobile
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Pobierz dostęp do mikrofonu - NIE wymuszaj sample rate (mobile tego nie obsługuje)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.current = stream

      // Utwórz AudioContext z DOMYŚLNYM sample rate (ważne dla iOS!)
      // @ts-expect-error - webkitAudioContext dla starszych Safari
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext

      // Na iOS trzeba resumować AudioContext po user interaction
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const actualSampleRate = audioContext.sampleRate
      console.log('Audio context sample rate:', actualSampleRate)

      // Utwórz source z mikrofonu
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Użyj ScriptProcessorNode - działa na wszystkich przeglądarkach
      const bufferSize = 4096
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = scriptProcessor

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)

        // Resampleuj do 16kHz (Gemini wymaga 16kHz PCM)
        const pcmData = resampleTo16kHz(inputData, actualSampleRate)

        // Kopiuj do nowego ArrayBuffer (pcmData.buffer to ArrayBufferLike)
        const buffer = new ArrayBuffer(pcmData.byteLength)
        new Int16Array(buffer).set(pcmData)
        onAudioData(buffer)
      }

      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      onRecordingChange(true)
      setPermissionDenied(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      if ((error as Error).name === 'NotAllowedError' || (error as Error).name === 'PermissionDeniedError') {
        setPermissionDenied(true)
      }
      onRecordingChange(false)
    }
  }, [onAudioData, onRecordingChange])

  const stopRecording = useCallback(() => {
    // Odłącz processor
    if (processorRef.current && sourceRef.current) {
      try {
        sourceRef.current.disconnect()
        processorRef.current.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }

    // Zatrzymaj wszystkie tracki
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Zamknij AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    sourceRef.current = null
    processorRef.current = null

    onRecordingChange(false)
  }, [onRecordingChange])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  if (!isSupported) {
    return (
      <div className="text-center p-4 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700 text-sm">
          Twoja przeglądarka nie obsługuje nagrywania audio.
          {isMobile && ' Spróbuj otworzyć w Chrome lub Safari.'}
        </p>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <div className="text-center p-4 bg-red-50 rounded-lg">
        <p className="text-red-700 text-sm">
          Brak dostępu do mikrofonu.
          {isMobile ? (
            <> Sprawdź ustawienia przeglądarki i systemu.</>
          ) : (
            <> Kliknij ikonę kłódki w pasku adresu i zezwól na mikrofon.</>
          )}
        </p>
        <button
          onClick={startRecording}
          className="mt-2 text-sm text-red-600 underline"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        className={`
          relative w-24 h-24 rounded-full transition-all duration-300
          flex items-center justify-center
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/50'
              : 'bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/30'
          }
        `}
      >
        {/* Animowany ring podczas nagrywania */}
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20" />
            <span className="absolute inset-1 rounded-full border-4 border-red-300 animate-pulse opacity-60" />
          </>
        )}

        {/* Ikona */}
        <svg
          className="w-10 h-10 text-white relative z-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isRecording ? (
            // Ikona fali dźwiękowej (mówimy)
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a3 3 0 00-3 3v4a3 3 0 006 0V6a3 3 0 00-3-3z"
            />
          ) : (
            // Ikona mikrofonu
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          )}
        </svg>
      </button>

      <p className="text-sm text-gray-500 text-center">
        {isRecording ? (
          <span className="text-red-600 font-medium">
            Mówię... (kliknij aby zatrzymać)
          </span>
        ) : (
          'Kliknij aby rozpocząć rozmowę'
        )}
      </p>

      {isMobile && !isRecording && (
        <p className="text-xs text-gray-400 text-center">
          Na telefonie może być potrzebne chwilkę na uruchomienie mikrofonu
        </p>
      )}
    </div>
  )
}
