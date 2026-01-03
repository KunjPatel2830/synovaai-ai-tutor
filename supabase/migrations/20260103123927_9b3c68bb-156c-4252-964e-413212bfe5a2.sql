-- Create peer rooms table for collaborative learning
CREATE TABLE public.peer_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  room_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  subject TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create peer room participants table
CREATE TABLE public.peer_room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.peer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

-- Create peer room messages table
CREATE TABLE public.peer_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.peer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'whiteboard')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create whiteboard data table
CREATE TABLE public.peer_whiteboard_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.peer_rooms(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.peer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_whiteboard_data ENABLE ROW LEVEL SECURITY;

-- Policies for peer_rooms
CREATE POLICY "Users can view active rooms they participate in"
ON public.peer_rooms FOR SELECT
USING (
  is_active = true AND (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.peer_room_participants
      WHERE room_id = id AND user_id = auth.uid() AND left_at IS NULL
    )
  )
);

CREATE POLICY "Authenticated users can create rooms"
ON public.peer_rooms FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms"
ON public.peer_rooms FOR UPDATE
USING (auth.uid() = created_by);

-- Policies for peer_room_participants
CREATE POLICY "Users can view participants in their rooms"
ON public.peer_room_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.peer_room_participants p2
    WHERE p2.room_id = room_id AND p2.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can join rooms"
ON public.peer_room_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
ON public.peer_room_participants FOR UPDATE
USING (auth.uid() = user_id);

-- Policies for peer_room_messages
CREATE POLICY "Users can view messages in their rooms"
ON public.peer_room_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.peer_room_participants
    WHERE room_id = peer_room_messages.room_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in their rooms"
ON public.peer_room_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.peer_room_participants
    WHERE room_id = peer_room_messages.room_id AND user_id = auth.uid() AND left_at IS NULL
  )
);

-- Policies for whiteboard
CREATE POLICY "Users can view whiteboard in their rooms"
ON public.peer_whiteboard_data FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.peer_room_participants
    WHERE room_id = peer_whiteboard_data.room_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update whiteboard in their rooms"
ON public.peer_whiteboard_data FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.peer_room_participants
    WHERE room_id = peer_whiteboard_data.room_id AND user_id = auth.uid() AND left_at IS NULL
  )
);

CREATE POLICY "Users can modify whiteboard in their rooms"
ON public.peer_whiteboard_data FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.peer_room_participants
    WHERE room_id = peer_whiteboard_data.room_id AND user_id = auth.uid() AND left_at IS NULL
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_whiteboard_data;

-- Create function to generate room code
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;