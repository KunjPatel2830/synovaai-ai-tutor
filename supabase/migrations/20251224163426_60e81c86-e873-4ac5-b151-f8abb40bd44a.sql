-- Add tutor_language column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tutor_language TEXT DEFAULT 'en-US';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.tutor_language IS 'User preferred language for AI tutor responses';