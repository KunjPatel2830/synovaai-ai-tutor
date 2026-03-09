
-- IP-based rate limiting for unauthenticated endpoints
CREATE TABLE public.ip_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ip_rate_limits_lookup ON public.ip_rate_limits (ip_address, endpoint, requested_at DESC);

-- RLS: no direct access
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to ip rate limits"
  ON public.ip_rate_limits FOR ALL
  USING (false)
  WITH CHECK (false);

-- Auto-cleanup trigger
CREATE OR REPLACE FUNCTION public.cleanup_old_ip_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.ip_rate_limits
  WHERE requested_at < now() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_ip_rate_limits
AFTER INSERT ON public.ip_rate_limits
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_ip_rate_limits();

-- IP-based rate limit check function
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  _ip_address text,
  _endpoint text,
  _max_requests integer DEFAULT 5,
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
  
  SELECT COUNT(*)::integer INTO _count
  FROM public.ip_rate_limits
  WHERE ip_address = _ip_address
    AND endpoint = _endpoint
    AND requested_at > _window_start;
  
  IF _count >= _max_requests THEN
    SELECT requested_at INTO _oldest_in_window
    FROM public.ip_rate_limits
    WHERE ip_address = _ip_address
      AND endpoint = _endpoint
      AND requested_at > _window_start
    ORDER BY requested_at ASC
    LIMIT 1;
    
    RETURN QUERY SELECT 
      false AS allowed, 
      _count AS current_count,
      GREATEST(1, EXTRACT(EPOCH FROM (_oldest_in_window + (_window_seconds || ' seconds')::interval - now()))::integer) AS retry_after;
  ELSE
    INSERT INTO public.ip_rate_limits (ip_address, endpoint)
    VALUES (_ip_address, _endpoint);
    
    RETURN QUERY SELECT 
      true AS allowed, 
      (_count + 1) AS current_count,
      0 AS retry_after;
  END IF;
END;
$$;
