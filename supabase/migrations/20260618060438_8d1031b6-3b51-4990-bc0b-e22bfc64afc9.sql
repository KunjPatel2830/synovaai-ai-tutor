
-- Revert the view to security_invoker=on so it doesn't trip the Security Definer View linter
ALTER VIEW public.reviews_public SET (security_invoker = on);

-- Allow anon/authenticated to read only the non-sensitive columns of the base table.
-- Column-level GRANTs combined with a permissive RLS policy let the view succeed
-- while a direct `SELECT user_id FROM reviews` is rejected at the column grant layer.
GRANT SELECT (id, display_name, content, rating, created_at) ON public.reviews TO anon, authenticated;

-- Add a permissive RLS SELECT policy scoped to the safe columns (RLS itself is row-level,
-- but combined with the column grant above, user_id remains inaccessible to non-owners).
CREATE POLICY "Public can read non-sensitive review columns"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);
