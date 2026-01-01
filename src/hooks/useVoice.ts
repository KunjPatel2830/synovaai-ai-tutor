import { useState, useEffect, useCallback, useRef } from "react";

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  selectedLanguage: string;
  autoSpeak: boolean;
  blindMode: boolean;
}

interface UseVoiceReturn extends VoiceState {
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
  setSelectedLanguage: (lang: string) => void;
  setAutoSpeak: (value: boolean) => void;
  setBlindMode: (value: boolean) => void;
  clearTranscript: () => void;
}

// Only English supported
const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
];

export { SUPPORTED_LANGUAGES };

export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: "",
    error: null,
    voices: [],
    selectedVoice: null,
    selectedLanguage: "en-US",
    autoSpeak: true,
    blindMode: false,
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setState((prev) => ({
          ...prev,
          voices: availableVoices,
          selectedVoice: availableVoices.find((v) => v.lang.startsWith("en")) || availableVoices[0],
        }));
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      setState((prev) => ({ ...prev, error: "Speech recognition not supported" }));
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = state.selectedLanguage;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setState((prev) => ({ ...prev, transcript: prev.transcript + finalTranscript }));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState((prev) => ({ ...prev, error: event.error, isListening: false }));
    };

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [state.selectedLanguage]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !state.isListening) {
      setState((prev) => ({ ...prev, transcript: "", error: null }));
      recognitionRef.current.lang = state.selectedLanguage;
      recognitionRef.current.start();
      setState((prev) => ({ ...prev, isListening: true }));
    }
  }, [state.isListening, state.selectedLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
      setState((prev) => ({ ...prev, isListening: false }));
    }
  }, [state.isListening]);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Split text into sentences for natural pauses
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentIndex = 0;
    
    const speakNext = () => {
      if (currentIndex < sentences.length) {
        const utterance = new SpeechSynthesisUtterance(sentences[currentIndex].trim());
        
        if (state.selectedVoice) {
          utterance.voice = state.selectedVoice;
        }
        
        utterance.lang = state.selectedLanguage;
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => {
          setState((prev) => ({ ...prev, isSpeaking: true }));
        };

        utterance.onend = () => {
          currentIndex++;
          if (currentIndex < sentences.length) {
            // Natural pause between sentences
            setTimeout(speakNext, 200);
          } else {
            setState((prev) => ({ ...prev, isSpeaking: false }));
          }
        };

        utterance.onerror = () => {
          setState((prev) => ({ ...prev, isSpeaking: false }));
        };

        window.speechSynthesis.speak(utterance);
      }
    };

    speakNext();
  }, [state.selectedVoice, state.selectedLanguage]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setState((prev) => ({ ...prev, selectedVoice: voice }));
  }, []);

  const setSelectedLanguage = useCallback((lang: string) => {
    setState((prev) => ({ ...prev, selectedLanguage: lang }));
  }, []);

  const setAutoSpeak = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, autoSpeak: prev.blindMode ? true : value }));
  }, []);

  const setBlindMode = useCallback((value: boolean) => {
    setState((prev) => ({ 
      ...prev, 
      blindMode: value,
      autoSpeak: value ? true : prev.autoSpeak 
    }));
  }, []);

  const clearTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: "" }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setSelectedVoice,
    setSelectedLanguage,
    setAutoSpeak,
    setBlindMode,
    clearTranscript,
  };
}
