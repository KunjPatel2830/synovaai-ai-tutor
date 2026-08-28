import { Mic, MicOff, Volume2, VolumeX, Eye, EyeOff, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  autoSpeak: boolean;
  blindMode: boolean;
  selectedLanguage: string;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onAutoSpeakChange: (value: boolean) => void;
  onBlindModeChange: (value: boolean) => void;
  onLanguageChange: (lang: string) => void;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  compact?: boolean;
}

export function VoiceControls({
  isListening,
  isSpeaking,
  autoSpeak,
  blindMode,
  selectedLanguage,
  voices,
  selectedVoice,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onAutoSpeakChange,
  onBlindModeChange,
  onLanguageChange,
  onVoiceChange,
  compact = false,
}: VoiceControlsProps) {
  const filteredVoices = voices.filter((v) =>
    v.lang.startsWith(selectedLanguage.split("-")[0])
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Mic Button */}
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={isListening ? onStopListening : onStartListening}
          className={cn(
            "h-10 w-10 shrink-0",
            isListening && "animate-pulse"
          )}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        {/* Speaker indicator */}
        {isSpeaking && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onStopSpeaking}
            className="h-10 w-10 shrink-0 animate-pulse"
          >
            <Volume2 className="h-5 w-5 text-primary" />
          </Button>
        )}

        {/* Settings Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0">
              <Settings2 className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Voice</Label>
                <Select
                  value={selectedVoice?.name || ""}
                  onValueChange={(name) => {
                    const voice = voices.find((v) => v.name === name);
                    if (voice) onVoiceChange(voice);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {(filteredVoices.length > 0 ? filteredVoices : voices.slice(0, 10)).map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name.split(" ").slice(0, 3).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-speak" className="text-sm font-medium">
                  Auto-speak
                </Label>
                <Switch
                  id="auto-speak"
                  checked={autoSpeak}
                  onCheckedChange={onAutoSpeakChange}
                  disabled={blindMode}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="blind-mode" className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Blind Mode
                </Label>
                <Switch
                  id="blind-mode"
                  checked={blindMode}
                  onCheckedChange={onBlindModeChange}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/50">
      {/* Mic Button */}
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="sm"
        onClick={isListening ? onStopListening : onStartListening}
        className={cn("gap-2", isListening && "animate-pulse")}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {isListening ? "Stop" : "Speak"}
      </Button>

      {/* Speaker indicator */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStopSpeaking}
        disabled={!isSpeaking}
        className={cn("gap-2", isSpeaking && "animate-pulse text-primary")}
      >
        {isSpeaking ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        {isSpeaking ? "Speaking..." : "Audio"}
      </Button>

      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Voice */}
      <Select
        value={selectedVoice?.name || ""}
        onValueChange={(name) => {
          const voice = voices.find((v) => v.name === name);
          if (voice) onVoiceChange(voice);
        }}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Voice" />
        </SelectTrigger>
        <SelectContent>
          {(filteredVoices.length > 0 ? filteredVoices : voices.slice(0, 10)).map((voice) => (
            <SelectItem key={voice.name} value={voice.name}>
              {voice.name.split(" ").slice(0, 2).join(" ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Toggles */}
      <div className="flex items-center gap-2">
        <Switch
          id="auto-speak-full"
          checked={autoSpeak}
          onCheckedChange={onAutoSpeakChange}
          disabled={blindMode}
        />
        <Label htmlFor="auto-speak-full" className="text-sm cursor-pointer">
          Auto
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="blind-mode-full"
          checked={blindMode}
          onCheckedChange={onBlindModeChange}
        />
        <Label htmlFor="blind-mode-full" className="text-sm cursor-pointer flex items-center gap-1">
          {blindMode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          Blind
        </Label>
      </div>
    </div>
  );
}
