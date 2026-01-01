import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Mic, MicOff, Volume2, VolumeX, RefreshCw, Globe } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LanguageOption {
  code: string;
  name: string;
  speechCode: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", speechCode: "en-US", flag: "🇺🇸" },
  { code: "es", name: "Spanish", speechCode: "es-ES", flag: "🇪🇸" },
  { code: "fr", name: "French", speechCode: "fr-FR", flag: "🇫🇷" },
  { code: "de", name: "German", speechCode: "de-DE", flag: "🇩🇪" },
  { code: "hi", name: "Hindi", speechCode: "hi-IN", flag: "🇮🇳" },
  { code: "zh", name: "Chinese", speechCode: "zh-CN", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", speechCode: "ja-JP", flag: "🇯🇵" },
  { code: "ko", name: "Korean", speechCode: "ko-KR", flag: "🇰🇷" },
  { code: "pt", name: "Portuguese", speechCode: "pt-BR", flag: "🇧🇷" },
  { code: "ar", name: "Arabic", speechCode: "ar-SA", flag: "🇸🇦" },
  { code: "ru", name: "Russian", speechCode: "ru-RU", flag: "🇷🇺" },
  { code: "it", name: "Italian", speechCode: "it-IT", flag: "🇮🇹" },
];

const WELCOME_MESSAGES: Record<string, string> = {
  en: "Welcome to SYNOVA Voice Tutor. I'm here to help you learn through voice interaction. Say 'Help' for available commands, or ask me any question to get started.",
  es: "Bienvenido a SYNOVA Voice Tutor. Estoy aquí para ayudarte a aprender a través de la interacción por voz. Di 'Ayuda' para ver los comandos disponibles, o hazme cualquier pregunta.",
  fr: "Bienvenue sur SYNOVA Voice Tutor. Je suis là pour vous aider à apprendre par l'interaction vocale. Dites 'Aide' pour les commandes disponibles, ou posez-moi une question.",
  de: "Willkommen bei SYNOVA Voice Tutor. Ich bin hier, um Ihnen beim Lernen durch Sprachinteraktion zu helfen. Sagen Sie 'Hilfe' für verfügbare Befehle oder stellen Sie mir eine Frage.",
  hi: "SYNOVA Voice Tutor में आपका स्वागत है। मैं आवाज़ बातचीत के माध्यम से सीखने में आपकी मदद के लिए यहाँ हूँ। उपलब्ध कमांड के लिए 'मदद' कहें या कोई भी सवाल पूछें।",
  zh: "欢迎来到SYNOVA语音导师。我在这里帮助您通过语音互动学习。说'帮助'查看可用命令，或问我任何问题。",
  ja: "SYNOVA Voice Tutorへようこそ。音声インタラクションを通じて学習をお手伝いします。利用可能なコマンドについては「ヘルプ」と言うか、質問をしてください。",
  ko: "SYNOVA Voice Tutor에 오신 것을 환영합니다. 음성 상호작용을 통해 학습을 도와드립니다. 사용 가능한 명령어는 '도움말'이라고 말하거나 질문을 해주세요.",
  pt: "Bem-vindo ao SYNOVA Voice Tutor. Estou aqui para ajudá-lo a aprender através da interação por voz. Diga 'Ajuda' para comandos disponíveis ou faça qualquer pergunta.",
  ar: "مرحبًا بك في SYNOVA Voice Tutor. أنا هنا لمساعدتك على التعلم من خلال التفاعل الصوتي. قل 'مساعدة' للأوامر المتاحة أو اسألني أي سؤال.",
  ru: "Добро пожаловать в SYNOVA Voice Tutor. Я здесь, чтобы помочь вам учиться через голосовое взаимодействие. Скажите 'Помощь' для доступных команд или задайте вопрос.",
  it: "Benvenuto in SYNOVA Voice Tutor. Sono qui per aiutarti a imparare attraverso l'interazione vocale. Di 'Aiuto' per i comandi disponibili o fammi qualsiasi domanda.",
};

export default function VoiceTutor() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<any>(null);
  const conversationHistoryRef = useRef<Message[]>([]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Get the best voice for current language
  const getVoiceForLanguage = useCallback((langCode: string): SpeechSynthesisVoice | null => {
    const language = LANGUAGES.find(l => l.code === langCode);
    if (!language) return null;

    // Try to find a voice that matches the language
    const matchingVoice = availableVoices.find(v => 
      v.lang.toLowerCase().startsWith(langCode.toLowerCase()) ||
      v.lang.toLowerCase().includes(language.speechCode.toLowerCase())
    );

    return matchingVoice || null;
  }, [availableVoices]);

  // Welcome message on mount and language change
  useEffect(() => {
    const welcomeMessage = WELCOME_MESSAGES[selectedLanguage] || WELCOME_MESSAGES.en;
    setMessages([{ role: "assistant", content: welcomeMessage }]);
    conversationHistoryRef.current = [{ role: "assistant", content: welcomeMessage }];
    if (autoSpeak) {
      speakText(welcomeMessage);
    }
  }, [selectedLanguage]);

  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      
      // Set the language
      const language = LANGUAGES.find(l => l.code === selectedLanguage);
      if (language) {
        utterance.lang = language.speechCode;
      }
      
      // Try to use a matching voice
      const voice = getVoiceForLanguage(selectedLanguage);
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    }
  }, [selectedLanguage, getVoiceForLanguage]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const handleVoiceCommand = useCallback((command: string) => {
    const lowerCommand = command.toLowerCase().trim();
    
    // Handle commands in different languages
    const repeatCommands = ["next", "continue", "siguiente", "continuar", "suivant", "continuer", "weiter", "अगला", "下一个", "次へ", "다음", "próximo", "التالي", "далее", "avanti"];
    const repeatAgainCommands = ["repeat", "again", "repetir", "répéter", "wiederholen", "दोहराएं", "重复", "繰り返し", "반복", "repetir", "كرر", "повторить", "ripetere"];
    const stopCommands = ["stop", "parar", "arrêter", "stopp", "रुको", "停止", "止まれ", "멈춰", "pare", "توقف", "стоп", "ferma"];
    const helpCommands = ["help", "ayuda", "aide", "hilfe", "मदद", "帮助", "ヘルプ", "도움말", "ajuda", "مساعدة", "помощь", "aiuto"];
    
    if (repeatCommands.some(cmd => lowerCommand.includes(cmd))) {
      speakText(selectedLanguage === "en" ? "Please ask your next question or say 'repeat' to hear the last response again." : WELCOME_MESSAGES[selectedLanguage]);
      return true;
    }
    if (repeatAgainCommands.some(cmd => lowerCommand.includes(cmd))) {
      const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
      if (lastAssistant) {
        speakText(lastAssistant.content);
      }
      return true;
    }
    if (stopCommands.some(cmd => lowerCommand.includes(cmd))) {
      stopSpeaking();
      return true;
    }
    if (helpCommands.some(cmd => lowerCommand.includes(cmd))) {
      const helpText = selectedLanguage === "en" 
        ? "Available commands: Say 'Next' to continue, 'Repeat' to hear the last response again, 'Stop' to stop speaking, 'Help' for this menu. You can also ask any question about your studies."
        : WELCOME_MESSAGES[selectedLanguage];
      const newMessages = [...messages, { role: "assistant" as const, content: helpText }];
      setMessages(newMessages);
      conversationHistoryRef.current = newMessages;
      speakText(helpText);
      return true;
    }
    return false;
  }, [messages, speakText, stopSpeaking, selectedLanguage]);

  const processQuestion = useCallback(async (question: string) => {
    setIsLoading(true);
    
    try {
      const language = LANGUAGES.find(l => l.code === selectedLanguage);
      const languageInstruction = language && language.code !== "en" 
        ? `Please respond in ${language.name}. ` 
        : "";

      const aiMessages = conversationHistoryRef.current.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      aiMessages.push({ role: "user", content: `${languageInstruction}${question}` });

      const response = await supabase.functions.invoke("ai-tutor", {
        body: {
          messages: aiMessages,
          mode: "chat",
        },
      });

      if (response.error) throw response.error;
      
      const reply = response.data.reply || "I understand your question. Let me help you with that.";
      
      const newMessages = [...conversationHistoryRef.current, 
        { role: "user" as const, content: question },
        { role: "assistant" as const, content: reply }
      ];
      setMessages(newMessages);
      conversationHistoryRef.current = newMessages;
      
      if (autoSpeak) {
        speakText(reply);
      }
    } catch (error) {
      console.error("Error processing question:", error);
      const errorMsg = selectedLanguage === "en" 
        ? "I'm sorry, I couldn't process your question. Please try again."
        : "Error processing your question. Please try again.";
      const newMessages = [...conversationHistoryRef.current, { role: "assistant" as const, content: errorMsg }];
      setMessages(newMessages);
      conversationHistoryRef.current = newMessages;
      if (autoSpeak) {
        speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [autoSpeak, speakText, selectedLanguage]);

  const startContinuousListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice recognition.",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Set language for recognition
    const language = LANGUAGES.find(l => l.code === selectedLanguage);
    recognition.lang = language?.speechCode || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      stopSpeaking();
    };

    recognition.onresult = async (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        
        const newMessages = [...conversationHistoryRef.current, { role: "user" as const, content: transcript }];
        setMessages(newMessages);
        conversationHistoryRef.current = newMessages;
        
        if (handleVoiceCommand(transcript)) {
          return;
        }
        
        await processQuestion(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        return;
      }
      console.error("Recognition error:", event.error);
      if (event.error === 'not-allowed') {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access to use voice input.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }
  }, [handleVoiceCommand, processQuestion, stopSpeaking, toast, isListening, selectedLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startContinuousListening();
    }
  }, [isListening, startContinuousListening, stopListening]);

  const handleLanguageChange = useCallback((newLang: string) => {
    // Stop any ongoing listening/speaking
    stopListening();
    stopSpeaking();
    setSelectedLanguage(newLang);
  }, [stopListening, stopSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const currentLanguage = LANGUAGES.find(l => l.code === selectedLanguage);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-5rem)] flex flex-col">
        {/* Header */}
        <GlassCard className="mb-2 shrink-0">
          <GlassCardHeader className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <GlassCardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-xl">Voice Tutor</span>
                  <p className="text-sm text-muted-foreground font-normal">Voice-first learning experience</p>
                </div>
              </GlassCardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Language Selector */}
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[140px]">
                    <Globe className="h-4 w-4 mr-2" />
                    <SelectValue>
                      {currentLanguage?.flag} {currentLanguage?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant={autoSpeak ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  aria-label={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
                >
                  {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">{autoSpeak ? "Auto-Speak" : "Auto-Speak Off"}</span>
                </Button>
              </div>
            </div>
          </GlassCardHeader>
        </GlassCard>

        {/* Chat Area - maximized */}
        <GlassCard className="flex-1 flex flex-col overflow-hidden min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border border-border"
                    }`}
                  >
                    <p className="text-base leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 border border-border p-4 rounded-2xl">
                    <Loader />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Voice Controls */}
          <div className="p-4 border-t border-border/50 shrink-0">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleVoiceCommand("repeat")}
                disabled={isLoading || messages.length < 2}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Repeat
              </Button>
              
              <Button
                size="lg"
                className={`h-16 w-16 rounded-full ${isListening ? "bg-destructive hover:bg-destructive/90 animate-pulse" : ""}`}
                onClick={toggleListening}
                disabled={isLoading}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={isSpeaking ? stopSpeaking : () => handleVoiceCommand("help")}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="h-5 w-5 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Volume2 className="h-5 w-5 mr-2" />
                    Help
                  </>
                )}
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {isListening 
                ? `Listening in ${currentLanguage?.name}... Speak anytime` 
                : `Tap the microphone to start (${currentLanguage?.name})`}
            </p>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
