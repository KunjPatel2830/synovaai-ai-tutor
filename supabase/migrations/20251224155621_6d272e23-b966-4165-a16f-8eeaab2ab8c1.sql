-- Create table to track login attempts
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient querying by email and time
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - this table is accessed only via security definer functions

-- Function to check if an email is locked out
CREATE OR REPLACE FUNCTION public.check_login_lockout(check_email TEXT)
RETURNS TABLE(is_locked BOOLEAN, locked_until TIMESTAMP WITH TIME ZONE, failed_attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  attempt_count INTEGER;
  lockout_threshold INTEGER := 5;
  lockout_window INTERVAL := '15 minutes';
  last_attempt_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count failed attempts in the lockout window
  SELECT COUNT(*), MAX(attempted_at)
  INTO attempt_count, last_attempt_time
  FROM login_attempts la
  WHERE la.email = LOWER(TRIM(check_email))
    AND la.attempted_at > now() - lockout_window
    AND la.success = false;
  
  -- Return lockout status
  IF attempt_count >= lockout_threshold THEN
    RETURN QUERY SELECT 
      true AS is_locked,
      (last_attempt_time + lockout_window) AS locked_until,
      attempt_count AS failed_attempts;
  ELSE
    RETURN QUERY SELECT 
      false AS is_locked,
      NULL::TIMESTAMP WITH TIME ZONE AS locked_until,
      attempt_count AS failed_attempts;
  END IF;
END;
$$;

-- Function to record a login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  attempt_email TEXT,
  attempt_success BOOLEAN,
  attempt_ip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert the attempt
  INSERT INTO login_attempts (email, success, ip_address)
  VALUES (LOWER(TRIM(attempt_email)), attempt_success, attempt_ip);
  
  -- Clean up old records (older than 24 hours)
  DELETE FROM login_attempts
  WHERE attempted_at < now() - INTERVAL '24 hours';
END;
$$;