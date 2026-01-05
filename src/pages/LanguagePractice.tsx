import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Globe, Send, Volume2, Mic, RefreshCw } from "lucide-react";
import { Loader, LoaderSpinner } from "@/components/ui/loader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Message {
  role: "user" | "assistant";
  content: string;
  translation?: string;
}

const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिंदी (Hindi)" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "zh", name: "中文 (Chinese)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
];

export default function LanguagePractice() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to Language Practice! Select your target language and start learning. I'll help you with vocabulary, pronunciation, and conversation practice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("es");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showTranslations, setShowTranslations] = useState(true);

  const speakText = (text: string, lang: string = selectedLanguage) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Simulate language learning response
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const targetLang = languages.find(l => l.code === selectedLanguage)?.name || "Spanish";
      
      let response = "";
      let translation = "";
      
      if (userMessage.toLowerCase().includes("hello") || userMessage.toLowerCase().includes("hi")) {
        if (selectedLanguage === "es") {
          response = "¡Hola! ¿Cómo estás? (OH-la, KOH-mo es-TAHS)";
          translation = "Hello! How are you?";
        } else if (selectedLanguage === "fr") {
          response = "Bonjour! Comment allez-vous? (bon-ZHOOR, koh-mahn tah-lay VOO)";
          translation = "Hello! How are you?";
        } else if (selectedLanguage === "de") {
          response = "Hallo! Wie geht es Ihnen? (HA-lo, vee GAYT es EE-nen)";
          translation = "Hello! How are you?";
        } else if (selectedLanguage === "hi") {
          response = "नमस्ते! आप कैसे हैं? (na-mas-TAY, aap KAY-say hain)";
          translation = "Hello! How are you?";
        } else {
          response = `In ${targetLang}, you would greet someone warmly. Let me teach you the proper greeting!`;
        }
      } else {
        response = `Great question about "${userMessage}"! In ${targetLang}, we would express this as follows. Would you like me to break down the vocabulary and pronunciation?`;
      }
      
      const assistantMessage: Message = { 
        role: "assistant", 
        content: response,
        translation: translation || undefined
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      if (autoSpeak && response) {
        speakText(response, selectedLanguage);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-5rem)] flex flex-col w-full">
        {/* Header */}
        <GlassCard className="mb-2 shrink-0">
          <GlassCardHeader className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <GlassCardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-xl">Language Practice</span>
                  <p className="text-sm text-muted-foreground font-normal">Learn languages with AI guidance</p>
                </div>
              </GlassCardTitle>
              
              <div className="flex items-center gap-4">
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCardHeader>
          
          <GlassCardContent className="pt-0 pb-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch 
                  id="auto-speak" 
                  checked={autoSpeak} 
                  onCheckedChange={setAutoSpeak}
                />
                <Label htmlFor="auto-speak" className="text-sm">Auto-Speak</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="translations" 
                  checked={showTranslations} 
                  onCheckedChange={setShowTranslations}
                />
                <Label htmlFor="translations" className="text-sm">Show Translations</Label>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Chat Area */}
        <GlassCard className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
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
                    {message.translation && showTranslations && (
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        📝 {message.translation}
                      </p>
                    )}
                    {message.role === "assistant" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => speakText(message.content, selectedLanguage)}
                      >
                        <Volume2 className="h-4 w-4 mr-2" />
                        Listen
                      </Button>
                    )}
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

          {/* Input Area */}
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type in English and I'll help you learn..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className="h-full"
                >
                  {isLoading ? <LoaderSpinner size="sm" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
