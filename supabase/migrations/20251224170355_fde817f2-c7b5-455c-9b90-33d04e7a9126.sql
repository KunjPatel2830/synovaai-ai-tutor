-- Add invitation_code_id to linking tables for audit trail
ALTER TABLE public.teacher_student_links 
ADD COLUMN invitation_code_id uuid REFERENCES public.invitation_codes(id);

ALTER TABLE public.caregiver_student_links 
ADD COLUMN invitation_code_id uuid REFERENCES public.invitation_codes(id);

-- Create secure function to link a student to a teacher using an invitation code
-- This function atomically validates, creates link, and marks code as used
CREATE OR REPLACE FUNCTION public.link_student_to_teacher(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation_id uuid;
  _teacher_id uuid;
  _student_id uuid;
  _link_id uuid;
BEGIN
  _student_id := auth.uid();
  
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate and get the invitation code details
  SELECT id, created_by INTO _invitation_id, _teacher_id
  FROM invitation_codes
  WHERE code = UPPER(TRIM(_code))
    AND inviter_role = 'teacher'
    AND used_at IS NULL
    AND expires_at > now();
  
  IF _invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;
  
  -- Check if link already exists
  IF EXISTS (
    SELECT 1 FROM teacher_student_links
    WHERE teacher_id = _teacher_id AND student_id = _student_id
  ) THEN
    RAISE EXCEPTION 'Already linked to this teacher';
  END IF;
  
  -- Create the link
  INSERT INTO teacher_student_links (teacher_id, student_id, invitation_code_id)
  VALUES (_teacher_id, _student_id, _invitation_id)
  RETURNING id INTO _link_id;
  
  -- Mark the invitation code as used
  UPDATE invitation_codes
  SET used_at = now(), used_by = _student_id
  WHERE id = _invitation_id;
  
  RETURN _link_id;
END;
$$;

-- Create secure function to link a student to a caregiver using an invitation code
CREATE OR REPLACE FUNCTION public.link_student_to_caregiver(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation_id uuid;
  _caregiver_id uuid;
  _student_id uuid;
  _link_id uuid;
BEGIN
  _student_id := auth.uid();
  
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate and get the invitation code details
  SELECT id, created_by INTO _invitation_id, _caregiver_id
  FROM invitation_codes
  WHERE code = UPPER(TRIM(_code))
    AND inviter_role = 'caregiver'
    AND used_at IS NULL
    AND expires_at > now();
  
  IF _invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;
  
  -- Check if link already exists
  IF EXISTS (
    SELECT 1 FROM caregiver_student_links
    WHERE caregiver_id = _caregiver_id AND student_id = _student_id
  ) THEN
    RAISE EXCEPTION 'Already linked to this caregiver';
  END IF;
  
  -- Create the link
  INSERT INTO caregiver_student_links (caregiver_id, student_id, invitation_code_id)
  VALUES (_caregiver_id, _student_id, _invitation_id)
  RETURNING id INTO _link_id;
  
  -- Mark the invitation code as used
  UPDATE invitation_codes
  SET used_at = now(), used_by = _student_id
  WHERE id = _invitation_id;
  
  RETURN _link_id;
END;
$$;

-- Drop existing permissive INSERT policies that don't require invitation codes
DROP POLICY IF EXISTS "Students can link themselves to teachers" ON public.teacher_student_links;
DROP POLICY IF EXISTS "Students can link themselves to caregivers" ON public.caregiver_student_links;

-- Block direct INSERT - links can only be created via the secure SECURITY DEFINER functions
-- The functions bypass RLS, so they can still insert
CREATE POLICY "Links require invitation code via secure function"
ON public.teacher_student_links
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Links require invitation code via secure function"
ON public.caregiver_student_links
FOR INSERT
WITH CHECK (false);