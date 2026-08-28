-- Drop the overly permissive SELECT policy that exposes created_by to all authenticated users
DROP POLICY IF EXISTS "Users can validate codes by code value" ON invitation_codes;

-- Create a secure function to validate invitation codes without exposing sensitive data
CREATE OR REPLACE FUNCTION public.validate_invitation_code(_code VARCHAR)
RETURNS TABLE(
  invitation_id UUID,
  inviter_role TEXT,
  inviter_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id,
    ic.inviter_role,
    ic.created_by
  FROM invitation_codes ic
  WHERE ic.code = UPPER(TRIM(_code))
    AND ic.used_at IS NULL
    AND ic.expires_at > now()
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_invitation_code(VARCHAR) TO authenticated;