-- Drop the redundant policies on login_attempts
DROP POLICY IF EXISTS "No anonymous access" ON public.login_attempts;
DROP POLICY IF EXISTS "No direct access - use SECURITY DEFINER functions only" ON public.login_attempts;

-- Create a single, clear deny-all policy
CREATE POLICY "Access only via SECURITY DEFINER functions" 
ON public.login_attempts 
FOR ALL 
USING (false) 
WITH CHECK (false);