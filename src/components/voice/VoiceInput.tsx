import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  isListening: boolean;
  transcript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onTranscriptChange: (text: string) => void;
}

export function VoiceInput({
  isListening,
  transcript,
  onStartListening,
  onStopListening,
  onTranscriptChange,
}: VoiceInputProps) {
  // Sync transcript to parent when it changes
  useEffect(() => {
    if (transcript) {
      onTranscriptChange(transcript);
    }
  }, [transcript, onTranscriptChange]);

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={isListening ? onStopListening : onStartListening}
      className={cn(
        "h-10 w-10 shrink-0 transition-all",
        isListening && "animate-pulse ring-2 ring-destructive/50"
      )}
      title={isListening ? "Stop listening" : "Start voice input"}
    >
      {isListening ? (
        <MicOff className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}
