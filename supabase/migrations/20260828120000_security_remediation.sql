-- Security Remediation Migration: Fixes invitation codes, peer room joins, and rate limiting RPC access

-- 1. invitation_codes: Restrict creation so users can only create codes matching their actual role
DROP POLICY IF EXISTS "Users can create invitation codes" ON public.invitation_codes;
CREATE POLICY "Users can create matching invitation codes"
ON public.invitation_codes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), inviter_role::public.app_role)
);

-- 2. peer_room_participants: Prevent direct arbitrary room joins via client RLS inserts.
-- Joins and creations must happen via authenticated server functions or room-code validation.
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON public.peer_room_participants;
DROP POLICY IF EXISTS "Authenticated users can join rooms as student" ON public.peer_room_participants;

CREATE POLICY "Direct room join blocked - use secure join function"
ON public.peer_room_participants
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3. Rate limiting RPC: Revoke direct client execution of check_rate_limit to prevent user DoS
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;
