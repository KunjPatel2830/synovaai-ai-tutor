-- Add curriculum preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN curriculum text DEFAULT 'CBSE';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.curriculum IS 'Student preferred curriculum (CBSE, NCERT, ICSE, Cambridge, IB, State Board, General)';