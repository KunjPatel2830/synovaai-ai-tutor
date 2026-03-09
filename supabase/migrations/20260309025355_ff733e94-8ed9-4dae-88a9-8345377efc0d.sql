
-- Rate limiting table for tracking per-user API requests
CREATE TABLE public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_user_endpoint ON public.api_rate_limits (user_id, endpoint, requested_at DESC);

-- Auto-cleanup: delete records older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE requested_at < now() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_rate_limits
AFTER INSERT ON public.api_rate_limits
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_rate_limits();

-- RLS: only service role can access this table
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to rate limits"
  ON public.api_rate_limits FOR ALL
  USING (false)
  WITH CHECK (false);

-- Rate limit check function (called by edge functions via service role)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _endpoint text,
  _max_requests integer DEFAULT 20,
  _window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, current_count integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
  _window_start timestamp with time zone;
  _oldest_in_window timestamp with time zone;
BEGIN
  _window_start := now() - (_window_seconds || ' seconds')::interval;
  
  -- Count requests in the window
  SELECT COUNT(*)::integer INTO _count
  FROM public.api_rate_limits
  WHERE user_id = _user_id
    AND endpoint = _endpoint
    AND requested_at > _window_start;
  
  IF _count >= _max_requests THEN
    -- Calculate retry_after from oldest request in window
    SELECT requested_at INTO _oldest_in_window
    FROM public.api_rate_limits
    WHERE user_id = _user_id
      AND endpoint = _endpoint
      AND requested_at > _window_start
    ORDER BY requested_at ASC
    LIMIT 1;
    
    RETURN QUERY SELECT 
      false AS allowed, 
      _count AS current_count,
      GREATEST(1, EXTRACT(EPOCH FROM (_oldest_in_window + (_window_seconds || ' seconds')::interval - now()))::integer) AS retry_after;
  ELSE
    -- Record this request
    INSERT INTO public.api_rate_limits (user_id, endpoint)
    VALUES (_user_id, _endpoint);
    
    RETURN QUERY SELECT 
      true AS allowed, 
      (_count + 1) AS current_count,
      0 AS retry_after;
  END IF;
END;
$$;
