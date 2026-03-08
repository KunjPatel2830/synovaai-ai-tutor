ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS standard text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_exam text DEFAULT NULL;