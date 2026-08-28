-- Recreate view as security-invoker (respects caller permissions/RLS)
DROP VIEW IF EXISTS public.badges_public;

CREATE VIEW public.badges_public
WITH (security_invoker=on) AS
SELECT
  id,
  name,
  description,
  icon,
  category,
  criteria_type
FROM public.badges;

-- Ensure the public view is read-only
REVOKE ALL ON public.badges_public FROM anon;
REVOKE ALL ON public.badges_public FROM authenticated;
GRANT SELECT ON public.badges_public TO anon;
GRANT SELECT ON public.badges_public TO authenticated;
