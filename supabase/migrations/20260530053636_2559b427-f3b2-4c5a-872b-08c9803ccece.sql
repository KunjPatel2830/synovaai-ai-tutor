
-- 1) Fix broken peer_rooms RLS self-join
DROP POLICY IF EXISTS "Users can view active rooms they participate in" ON public.peer_rooms;
CREATE POLICY "Users can view active rooms they participate in"
ON public.peer_rooms
FOR SELECT
USING (
  is_active = true
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.peer_room_participants p
      WHERE p.room_id = peer_rooms.id
        AND p.user_id = auth.uid()
        AND p.left_at IS NULL
    )
  )
);

-- 2) Add SELECT policy on reviews so reviews_public view can function under security_invoker
-- Reviews are public content; user_id is excluded via the reviews_public view.
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
CREATE POLICY "Anyone can read reviews"
ON public.reviews
FOR SELECT
USING (true);

GRANT SELECT ON public.reviews TO anon, authenticated;

-- 3) Harden user_roles: restrictive policy preventing privilege escalation via INSERT
-- Existing permissive INSERT allows only role='student' for self; add a restrictive
-- policy to ensure no future permissive policy can grant teacher/admin self-assignment,
-- and block UPDATE/DELETE entirely from non-service roles.
DROP POLICY IF EXISTS "Block role escalation" ON public.user_roles;
CREATE POLICY "Block role escalation"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'student'::public.app_role);

DROP POLICY IF EXISTS "No user updates of roles" ON public.user_roles;
CREATE POLICY "No user updates of roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No user deletes of roles" ON public.user_roles;
CREATE POLICY "No user deletes of roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);

-- 4) Realtime channel authorization: restrict realtime.messages subscriptions
-- so users can only subscribe to topics they're authorized for.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized realtime read" ON realtime.messages;
CREATE POLICY "Authorized realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- student_teacher_messages-<studentId>-<teacherId>  (StudentMessaging channel)
  (
    realtime.topic() LIKE 'messages-%'
    AND (
      split_part(realtime.topic(), '-', 2)::uuid = auth.uid()
      OR split_part(realtime.topic(), '-', 3)::uuid = auth.uid()
    )
  )
  -- Peer room channels keyed by room id (peer_room_messages, whiteboard, voice signals)
  OR (
    realtime.topic() ~ '^(peer-room|peer_room|room|whiteboard|voice)[-_:].+'
    AND public.is_peer_room_participant(
      (regexp_match(realtime.topic(), '[-_:]([0-9a-fA-F-]{36})$'))[1]::uuid,
      auth.uid()
    )
  )
  -- Personal channels (e.g. learning_history-<userId>)
  OR (
    realtime.topic() ~ '[-_:]([0-9a-fA-F-]{36})$'
    AND (regexp_match(realtime.topic(), '[-_:]([0-9a-fA-F-]{36})$'))[1]::uuid = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authorized realtime broadcast" ON realtime.messages;
CREATE POLICY "Authorized realtime broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() ~ '[-_:]([0-9a-fA-F-]{36})$'
  AND (
    (regexp_match(realtime.topic(), '[-_:]([0-9a-fA-F-]{36})$'))[1]::uuid = auth.uid()
    OR public.is_peer_room_participant(
      (regexp_match(realtime.topic(), '[-_:]([0-9a-fA-F-]{36})$'))[1]::uuid,
      auth.uid()
    )
  )
);
