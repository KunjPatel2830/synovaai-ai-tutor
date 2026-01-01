-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can read subjects" ON public.subjects;

-- Create a new policy requiring authentication
CREATE POLICY "Authenticated users can read subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (true);