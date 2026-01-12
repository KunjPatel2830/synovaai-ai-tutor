-- Create a trigger function to automatically insert user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value app_role;
BEGIN
  -- Get role from user metadata, default to 'student' if not set
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'student'::app_role
  );
  
  -- Insert the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create trigger that fires on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();