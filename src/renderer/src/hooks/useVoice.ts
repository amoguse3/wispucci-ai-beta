import { useState, useRef, useCallback, useEffect } from 'react'
import type { VoiceSettings } from '../../../../shared/types'

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export function useVoice() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    window.aura.voice.getSettings().then(setSettings)
  }, [])

  // --- TTS: Text-to-Speech ---

  const speak = useCallback((text: string) => {
    if (!settings?.ttsEnabled || !text.trim()) return

    // Stop any current speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = settings.language || 'en-US'
    utterance.rate = settings.ttsRate || 0.9
    utterance.pitch = settings.ttsPitch || 0.95
    utterance.volume = settings.ttsVolume || 1

    // Find best voice for the current language
    const voices = window.speechSynthesis.getVoices()
    const preferred = ['Microsoft David', 'Microsoft Zira', 'Google US English', 'Microsoft Andrei', 'Google română']
    let voice = settings.voiceName
      ? voices.find(v => v.name === settings.voiceName)
      : null

    if (!voice) {
      for (const name of preferred) {
        voice = voices.find(v => v.name.includes(name)) || null
        if (voice) break
      }
    }
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith('en')) || null
    }
    if (voice) utterance.voice = voice

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [settings])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  // --- STT: Speech-to-Text ---

  const startListening = useCallback((onResult: (text: string) => void, continuous = false) => {
    if (!SpeechRecognition || !settings?.sttEnabled) return

    stopSpeaking()

    const recognition = new SpeechRecognition()
    recognition.lang = settings.language || 'ro-RO'
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(finalTranscript + interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim())
      }
      finalTranscript = ''
      setTranscript('')
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error)
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [settings, stopSpeaking])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // --- Voice Call (continuous loop) ---

  const liveCallRef = useRef(false)

  const startVoiceCall = useCallback((onMessage: (text: string) => void) => {
    liveCallRef.current = true

    const listenLoop = () => {
      if (!liveCallRef.current || !SpeechRecognition) return

      const recognition = new SpeechRecognition()
      recognition.lang = settings?.language || 'ro-RO'
      recognition.continuous = false
      recognition.interimResults = true

      let finalText = ''

      recognition.onstart = () => setIsListening(true)

      recognition.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript + ' '
          } else {
            interim += event.results[i][0].transcript
          }
        }
        setTranscript(finalText + interim)
      }

      recognition.onend = () => {
        setIsListening(false)
        setTranscript('')
        if (finalText.trim() && liveCallRef.current) {
          onMessage(finalText.trim())
        }
        // Restart listening after a short delay (to allow TTS to finish)
        if (liveCallRef.current) {
          setTimeout(() => {
            if (liveCallRef.current) listenLoop()
          }, 500)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        // Retry on error if still in call
        if (liveCallRef.current) {
          setTimeout(() => {
            if (liveCallRef.current) listenLoop()
          }, 1000)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    }

    listenLoop()
  }, [settings])

  const endVoiceCall = useCallback(() => {
    liveCallRef.current = false
    stopListening()
    stopSpeaking()
  }, [stopListening, stopSpeaking])

  const isInCall = () => liveCallRef.current

  return {
    speak, stopSpeaking, isSpeaking,
    startListening, stopListening, isListening,
    startVoiceCall, endVoiceCall, isInCall,
    transcript,
    hasSpeechRecognition: !!SpeechRecognition
  }
}
