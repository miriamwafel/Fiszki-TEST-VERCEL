'use client'

import { useCallback, useRef, useState, useEffect } from 'react'

interface LiveAudioRecorderProps {
  onAudioData: (data: ArrayBuffer) => void
  isActive: boolean // Czy rozmowa jest aktywna (ciągłe nagrywanie)
  onActiveChange: (active: boolean) => void
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
    const sample = Math.max(-1, Math.min(1, inputBuffer[srcIndex]))
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

export function LiveAudioRecorder({
  onAudioData,
  isActive,
  onActiveChange,
  disabled = false,
}: LiveAudioRecorderProps) {
  const [isSupported, setIsSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false)
    }
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  const startRecording = useCallback(async () => {
    setIsInitializing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.current = stream

      // @ts-expect-error - webkitAudioContext dla starszych Safari
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext

      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const actualSampleRate = audioContext.sampleRate
      console.log('Audio context sample rate:', actualSampleRate)

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      const bufferSize = 4096
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = scriptProcessor

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const pcmData = resampleTo16kHz(inputData, actualSampleRate)
        const buffer = new ArrayBuffer(pcmData.byteLength)
        new Int16Array(buffer).set(pcmData)
        onAudioData(buffer)
      }

      source.connect(scriptProcessor)

      // Utwórz cichy GainNode jako "sink" - zapobiega pętli zwrotnej na mobile
      // ScriptProcessorNode wymaga połączenia z destination aby działać,
      // ale ustawiamy gain=0 żeby nie było słychać mikrofonu w głośnikach
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0 // Całkowicie wycisz
      scriptProcessor.connect(gainNode)
      gainNode.connect(audioContext.destination)

      onActiveChange(true)
      setPermissionDenied(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      if ((error as Error).name === 'NotAllowedError' || (error as Error).name === 'PermissionDeniedError') {
        setPermissionDenied(true)
      }
      onActiveChange(false)
    } finally {
      setIsInitializing(false)
    }
  }, [onAudioData, onActiveChange])

  const stopRecording = useCallback(() => {
    if (processorRef.current && sourceRef.current) {
      try {
        sourceRef.current.disconnect()
        processorRef.current.disconnect()
      } catch {
        // Ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    sourceRef.current = null
    processorRef.current = null

    onActiveChange(false)
  }, [onActiveChange])

  const toggleConversation = useCallback(() => {
    if (isActive) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isActive, startRecording, stopRecording])

  // Zatrzymaj nagrywanie gdy disabled=true (np. gdy AI mówi)
  useEffect(() => {
    if (disabled && isActive) {
      stopRecording()
    }
  }, [disabled, isActive, stopRecording])

  // Cleanup przy unmount
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

  const handleInteractionStart = useCallback(() => {
    if (disabled || isInitializing) return
    if (isMobile) {
      // Mobile: push-to-talk - zacznij nagrywać
      if (!isActive) {
        startRecording()
      }
    } else {
      // Desktop: toggle
      toggleConversation()
    }
  }, [disabled, isInitializing, isMobile, isActive, startRecording, toggleConversation])

  const handleInteractionEnd = useCallback(() => {
    if (disabled || isInitializing) return
    if (isMobile && isActive) {
      // Mobile: push-to-talk - zatrzymaj nagrywanie po puszczeniu
      stopRecording()
    }
  }, [disabled, isInitializing, isMobile, isActive, stopRecording])

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={!isMobile ? handleInteractionStart : undefined}
        onMouseDown={isMobile ? handleInteractionStart : undefined}
        onMouseUp={isMobile ? handleInteractionEnd : undefined}
        onMouseLeave={isMobile ? handleInteractionEnd : undefined}
        onTouchStart={isMobile ? handleInteractionStart : undefined}
        onTouchEnd={isMobile ? handleInteractionEnd : undefined}
        disabled={disabled || isInitializing}
        className={`
          relative w-32 h-32 rounded-full transition-all duration-500
          flex items-center justify-center
          ${disabled || isInitializing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${
            isActive
              ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl shadow-red-500/50 scale-110'
              : 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30 hover:scale-105'
          }
        `}
      >
        {/* Animacje podczas aktywnej rozmowy */}
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20" />
            <span className="absolute inset-2 rounded-full border-4 border-white/30 animate-pulse" />
            {/* Fale dźwiękowe */}
            <span className="absolute inset-[-8px] rounded-full border-2 border-red-300/50 animate-[ping_1.5s_ease-in-out_infinite]" />
            <span className="absolute inset-[-16px] rounded-full border-2 border-red-300/30 animate-[ping_2s_ease-in-out_infinite]" />
          </>
        )}

        {isInitializing ? (
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg
            className="w-12 h-12 text-white relative z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isActive ? (
              // Ikona stop (kwadrat)
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
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
        )}
      </button>

      <div className="text-center">
        <p className={`text-lg font-medium ${isActive ? 'text-red-600' : 'text-gray-700'}`}>
          {isInitializing ? (
            'Uruchamianie mikrofonu...'
          ) : isActive ? (
            isMobile ? 'Mówisz...' : 'Rozmowa aktywna'
          ) : (
            isMobile ? 'Przytrzymaj aby mówić' : 'Rozpocznij rozmowę'
          )}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {isActive ? (
            isMobile ? 'Puść aby AI odpowiedziało' : 'Kliknij aby zakończyć'
          ) : (
            isMobile ? 'Trzymaj przycisk podczas mówienia' : 'Kliknij aby zacząć mówić z AI'
          )}
        </p>
      </div>

      {isActive && !disabled && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          {isMobile ? 'Mikrofon nasłuchuje...' : 'Mikrofon aktywny - mów swobodnie'}
        </div>
      )}

      {disabled && isActive && (
        <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
          <span className="w-2 h-2 bg-orange-500 rounded-full" />
          AI mówi - mikrofon wstrzymany
        </div>
      )}

      {isMobile && !isActive && !disabled && (
        <div className="text-center max-w-xs space-y-2">
          <p className="text-xs text-primary-600 font-medium bg-primary-50 px-3 py-2 rounded-lg">
            💡 Push-to-talk: Przytrzymuj przycisk kiedy mówisz, puść aby AI odpowiedziało
          </p>
          <p className="text-xs text-gray-400">
            Transkrypcja może działać tylko po angielsku
          </p>
        </div>
      )}
    </div>
  )
}

// Eksport dla kompatybilności wstecznej
export { LiveAudioRecorder as default }
