'use client'

import { useCallback, useRef, useState, useEffect } from 'react'

interface LiveAudioRecorderProps {
  onAudioData: (data: ArrayBuffer) => void
  isRecording: boolean
  onRecordingChange: (recording: boolean) => void
  disabled?: boolean
}

export function LiveAudioRecorder({
  onAudioData,
  isRecording,
  onRecordingChange,
  disabled = false,
}: LiveAudioRecorderProps) {
  const [isSupported, setIsSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Sprawdź wsparcie
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      // Pobierz dostęp do mikrofonu
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream

      // Utwórz AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Utwórz source z mikrofonu
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Użyj ScriptProcessorNode (deprecated ale szeroko wspierany)
      // W przyszłości można zamienić na AudioWorklet
      const bufferSize = 4096
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)

        // Konwertuj Float32Array na Int16Array (PCM 16-bit)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          // Clamp do zakresu [-1, 1] i skaluj do Int16
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        onAudioData(pcmData.buffer)
      }

      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      onRecordingChange(true)
      setPermissionDenied(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      if ((error as Error).name === 'NotAllowedError') {
        setPermissionDenied(true)
      }
      onRecordingChange(false)
    }
  }, [onAudioData, onRecordingChange])

  const stopRecording = useCallback(() => {
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
    workletNodeRef.current = null

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
        </p>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <div className="text-center p-4 bg-red-50 rounded-lg">
        <p className="text-red-700 text-sm">
          Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.
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
    </div>
  )
}
