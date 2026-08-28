-- Add table for WebRTC signaling in peer rooms
CREATE TABLE public.peer_voice_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.peer_rooms(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate'
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.peer_voice_signals ENABLE ROW LEVEL SECURITY;

-- Participants can read signals directed to them or broadcast
CREATE POLICY "Participants can read their signals"
ON public.peer_voice_signals
FOR SELECT
USING (
  public.is_peer_room_participant(room_id, auth.uid())
  AND (to_user_id IS NULL OR to_user_id = auth.uid())
);

-- Participants can insert signals
CREATE POLICY "Participants can send signals"
ON public.peer_voice_signals
FOR INSERT
WITH CHECK (
  public.is_peer_room_participant(room_id, auth.uid())
  AND from_user_id = auth.uid()
);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_voice_signals;

-- Auto-cleanup old signals (older than 1 minute)
CREATE OR REPLACE FUNCTION public.cleanup_old_voice_signals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.peer_voice_signals
  WHERE created_at < now() - INTERVAL '1 minute';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_voice_signals_trigger
AFTER INSERT ON public.peer_voice_signals
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_voice_signals();