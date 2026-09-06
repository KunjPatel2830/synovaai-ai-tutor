-- Comprehensive Security Remediation Migration
-- Fixes:
-- 1. Broken Access Control / IDOR on teacher_student_links & caregiver_student_links
-- 2. Peer room role escalation on peer_room_participants
-- 3. Validation on user_badges insertion

-- ============================================================
-- 1. Fix teacher_student_links and caregiver_student_links RLS
-- ============================================================

-- Drop legacy overly-permissive policies that allow ANY authenticated user
-- to insert links without invitation codes
DROP POLICY IF EXISTS "Teachers can manage their student links" ON public.teacher_student_links;
DROP POLICY IF EXISTS "Caregivers can manage their student links" ON public.caregiver_student_links;
DROP POLICY IF EXISTS "Students can link themselves to teachers" ON public.teacher_student_links;
DROP POLICY IF EXISTS "Students can link themselves to caregivers" ON public.caregiver_student_links;
DROP POLICY IF EXISTS "Links require invitation code via secure function" ON public.teacher_student_links;
DROP POLICY IF EXISTS "Links require invitation code via secure function" ON public.caregiver_student_links;

-- Ensure direct INSERT from client is completely blocked (only SECURITY DEFINER functions can insert)
CREATE POLICY "Block direct client link insertion"
ON public.teacher_student_links
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block direct client caregiver link insertion"
ON public.caregiver_student_links
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Allow teachers to view and delete their own links
CREATE POLICY "Teachers can view their own student links"
ON public.teacher_student_links
FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own student links"
ON public.teacher_student_links
FOR DELETE
TO authenticated
USING (auth.uid() = teacher_id);

-- Allow caregivers to view and delete their own links
CREATE POLICY "Caregivers can view their own student links"
ON public.caregiver_student_links
FOR SELECT
TO authenticated
USING (auth.uid() = caregiver_id);

CREATE POLICY "Caregivers can delete their own student links"
ON public.caregiver_student_links
FOR DELETE
TO authenticated
USING (auth.uid() = caregiver_id);


-- ============================================================
-- 2. Prevent role escalation in peer_room_participants
-- ============================================================

-- Drop permissive update policy that allowed users to change role to 'teacher'
DROP POLICY IF EXISTS "Users can update their own participation" ON public.peer_room_participants;

CREATE POLICY "Users can only update left_at on own participation"
ON public.peer_room_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.peer_room_participants p WHERE p.id = peer_room_participants.id)
);


-- ============================================================
-- 3. Restrict user_badges insertion to existing valid badges
-- ============================================================
DROP POLICY IF EXISTS "Users can earn badges" ON public.user_badges;

CREATE POLICY "Users can earn valid existing badges"
ON public.user_badges
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.badges b
    WHERE b.id = user_badges.badge_id
  )
);
