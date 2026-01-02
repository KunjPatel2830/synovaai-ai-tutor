-- Drop the existing restrictive check constraint
ALTER TABLE public.pyq_questions DROP CONSTRAINT pyq_questions_exam_type_check;

-- Add new constraint with expanded valid exam types
ALTER TABLE public.pyq_questions ADD CONSTRAINT pyq_questions_exam_type_check 
CHECK (exam_type IN ('JEE', 'NEET', 'JEE Main', 'JEE Advanced'));