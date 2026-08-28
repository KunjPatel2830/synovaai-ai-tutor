
-- 1) Reviews: remove public read on base table; public reads go through reviews_public view
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can read reviews via view" ON public.reviews;

-- Owners can still read their own row from the base table
CREATE POLICY "Owners can read their own review"
ON public.reviews
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure the public-facing view can read base table rows under security_invoker
-- by granting SELECT to the roles that read the view.
REVOKE SELECT ON public.reviews FROM anon;
-- authenticated keeps SELECT (filtered by RLS to owner rows)

-- The reviews_public view runs with security_invoker=on. To allow anon to read it,
-- we expose only the view (which excludes user_id) and grant SELECT on it.
GRANT SELECT ON public.reviews_public TO anon, authenticated;

-- Allow the view to bypass base-table RLS for the safe columns via a SECURITY DEFINER wrapper:
-- Easiest: recreate the view with security_invoker=off so the view owner's privileges apply,
-- and the view itself only selects non-sensitive columns.
ALTER VIEW public.reviews_public SET (security_invoker = off);

-- 2) Invitation codes: enforce role matching on claim
DROP POLICY IF EXISTS "Students can use invitation codes" ON public.invitation_codes;

CREATE POLICY "Users can claim matching-role invitation codes"
ON public.invitation_codes
FOR UPDATE
TO authenticated
USING (
  used_at IS NULL
  AND expires_at > now()
  AND public.has_role(auth.uid(), inviter_role::public.app_role) = false
  AND (
    (inviter_role = 'teacher'   AND public.has_role(auth.uid(), 'student'::public.app_role))
    OR (inviter_role = 'caregiver' AND public.has_role(auth.uid(), 'student'::public.app_role))
    OR (inviter_role = 'student'   AND public.has_role(auth.uid(), 'student'::public.app_role))
  )
)
WITH CHECK (
  auth.uid() = used_by
  AND (
    (inviter_role IN ('teacher','caregiver','student'))
    AND public.has_role(auth.uid(), 'student'::public.app_role)
  )
);

-- 3) peer_room_participants: pin role to 'student' on INSERT
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON public.peer_room_participants;

CREATE POLICY "Authenticated users can join rooms as student"
ON public.peer_room_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'student'
);

-- Prevent privilege escalation via UPDATE of the role column
DROP POLICY IF EXISTS "Users can update their own participation" ON public.peer_room_participants;

CREATE POLICY "Users can update their own participation"
ON public.peer_room_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND role = 'student');

-- 4) Lock down SECURITY DEFINER helper/trigger functions from direct API exposure.
-- Trigger-only and internal helpers: revoke EXECUTE from anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_voice_signals()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_ip_rate_limits()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_profile()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_help_request()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_st_message()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_chat_message()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_review()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_peer_room()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_peer_room_message()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.strip_html_tags(text)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_room_code()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invitation_code()             FROM PUBLIC, anon, authenticated;

-- Internal rate-limit and lookup helpers: keep service_role only (revoke from anon/authenticated).
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_peer_room_participant(uuid, uuid)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_invitation_code(varchar)                      FROM PUBLIC, anon;

-- Login lockout / attempt recording is called from the auth flow (possibly while anon).
-- Keep callable, but document intent: anon + authenticated only.
-- (No revoke needed.)

-- link_student_to_teacher / link_student_to_caregiver are called by signed-in students.
REVOKE EXECUTE ON FUNCTION public.link_student_to_teacher(text)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_student_to_caregiver(text) FROM PUBLIC, anon;
