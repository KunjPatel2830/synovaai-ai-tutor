-- Add explicit deny-all policy for login_attempts table
-- This table should ONLY be accessed via SECURITY DEFINER functions
-- Direct user access is not allowed

CREATE POLICY "No direct access - use SECURITY DEFINER functions only"
ON public.login_attempts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Also deny anonymous access explicitly
CREATE POLICY "No anonymous access"
ON public.login_attempts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);