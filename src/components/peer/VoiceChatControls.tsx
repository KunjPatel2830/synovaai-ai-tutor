import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceChatControlsProps {
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  connectedPeers: string[];
  onStartVoice: () => void;
  onStopVoice: () => void;
  onToggleMute: () => void;
}

export function VoiceChatControls({
  isVoiceEnabled,
  isMuted,
  isConnecting,
  connectedPeers,
  onStartVoice,
  onStopVoice,
  onToggleMute,
}: VoiceChatControlsProps) {
  if (!isVoiceEnabled) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStartVoice}
        disabled={isConnecting}
        className="gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            Join Voice
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1",
          connectedPeers.length > 0 
            ? "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400" 
            : "bg-primary/20 border-primary"
        )}
      >
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          connectedPeers.length > 0 ? "bg-green-500" : "bg-primary"
        )} />
        {connectedPeers.length > 0 
          ? `${connectedPeers.length + 1} in call` 
          : "In voice chat"
        }
      </Badge>

      <Button
        variant={isMuted ? "destructive" : "outline"}
        size="icon"
        onClick={onToggleMute}
        className="h-8 w-8"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        onClick={onStopVoice}
        className="h-8 w-8"
        title="Leave voice chat"
      >
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
}