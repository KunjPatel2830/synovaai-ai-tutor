-- Security Hardening: Create secure views to hide sensitive user IDs

-- 1. Create a secure view for reviews that hides user_id
CREATE VIEW public.reviews_public
WITH (security_invoker=on) AS
SELECT 
  id, 
  rating, 
  created_at, 
  display_name, 
  content
FROM public.reviews;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.reviews_public TO authenticated;
GRANT SELECT ON public.reviews_public TO anon;

-- 2. Create a secure view for pyq_questions that hides created_by
CREATE VIEW public.pyq_questions_public
WITH (security_invoker=on) AS
SELECT 
  id,
  year,
  options,
  created_at,
  shift,
  subject,
  topic,
  question_text,
  correct_option,
  explanation,
  difficulty,
  exam_type
FROM public.pyq_questions;

-- Grant SELECT on the view
GRANT SELECT ON public.pyq_questions_public TO authenticated;
GRANT SELECT ON public.pyq_questions_public TO anon;

-- 3. Create a limited badge view that hides exact criteria (optional - keeps some mystery)
CREATE VIEW public.badges_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  description,
  icon,
  category,
  criteria_type
  -- Intentionally omitting criteria_value and points to prevent gaming
FROM public.badges;

-- Grant SELECT on the view
GRANT SELECT ON public.badges_public TO authenticated;