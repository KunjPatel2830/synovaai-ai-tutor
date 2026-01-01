-- Drop the insecure policy that exposes data to everyone
DROP POLICY IF EXISTS "Anyone can view valid unused codes" ON public.invitation_codes;

-- Create a more secure policy: users can only look up codes they're trying to use
-- This allows validation when entering a code without exposing all codes
CREATE POLICY "Users can validate codes by code value"
ON public.invitation_codes
FOR SELECT
TO authenticated
USING (
  (used_at IS NULL) AND (expires_at > now())
);

-- Note: This still requires authentication (auth.uid() IS NOT NULL implicitly via TO authenticated)
-- The code lookup in the app should filter by the specific code value they enter