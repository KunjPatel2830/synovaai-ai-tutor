-- Create invitation codes table
CREATE TABLE public.invitation_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  inviter_role TEXT NOT NULL CHECK (inviter_role IN ('teacher', 'caregiver')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID
);

-- Enable RLS
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Teachers/caregivers can view and create their own codes
CREATE POLICY "Users can view their own invitation codes"
ON public.invitation_codes
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can create invitation codes"
ON public.invitation_codes
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Students can view codes to use them (for validation)
CREATE POLICY "Anyone can view valid unused codes"
ON public.invitation_codes
FOR SELECT
USING (used_at IS NULL AND expires_at > now());

-- Allow updating codes when used
CREATE POLICY "Students can use invitation codes"
ON public.invitation_codes
FOR UPDATE
USING (used_at IS NULL AND expires_at > now())
WITH CHECK (auth.uid() = used_by);

-- Create function to generate unique codes
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;