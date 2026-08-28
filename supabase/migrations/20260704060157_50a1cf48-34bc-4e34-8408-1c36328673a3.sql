
-- 1. learning_history: restrict to authenticated
ALTER POLICY "Users can manage own learning history" ON public.learning_history TO authenticated;
ALTER POLICY "Teachers can view linked student learning history" ON public.learning_history TO authenticated;
ALTER POLICY "Caregivers can view linked student learning history" ON public.learning_history TO authenticated;

-- 2. pyq_questions: restrict read to authenticated
ALTER POLICY "Anyone can read PYQ questions" ON public.pyq_questions TO authenticated;

-- 3. realtime: remove learning_history from broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.learning_history;

-- 4. reviews: drop public/anon SELECT policy on base table (reviews_public view remains)
DROP POLICY IF EXISTS "Public can read non-sensitive review columns" ON public.reviews;
REVOKE SELECT ON public.reviews FROM anon;

-- 5. SECURITY DEFINER function EXECUTE hardening
-- Revoke from PUBLIC and anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_peer_room_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_login_lockout(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_ip_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_voice_signals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_student_to_caregiver(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_student_to_teacher(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_help_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_invitation_code(varchar) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_peer_room() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_peer_room_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_st_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon;

-- Grant back to authenticated where the client legitimately needs to call them
GRANT EXECUTE ON FUNCTION public.is_peer_room_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_student_to_caregiver(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_student_to_teacher(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO authenticated;
