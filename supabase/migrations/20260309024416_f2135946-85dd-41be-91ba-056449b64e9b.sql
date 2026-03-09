
-- ============================================================================
-- Database-level input validation triggers for XSS and data integrity
-- ============================================================================

-- 1. Text sanitization function: strips HTML tags from text fields
CREATE OR REPLACE FUNCTION public.strip_html_tags(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remove HTML tags
  RETURN regexp_replace(input, '<[^>]*>', '', 'g');
END;
$$;

-- 2. Validation trigger for peer_room_messages
CREATE OR REPLACE FUNCTION public.validate_peer_room_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML from message
  NEW.message := strip_html_tags(NEW.message);
  
  -- Enforce length limit
  IF length(NEW.message) > 5000 THEN
    NEW.message := left(NEW.message, 5000);
  END IF;
  
  -- Reject empty messages
  IF trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  
  -- Validate message_type
  IF NEW.message_type NOT IN ('text', 'ai', 'system') THEN
    RAISE EXCEPTION 'Invalid message_type';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_peer_room_message ON public.peer_room_messages;
CREATE TRIGGER trg_validate_peer_room_message
  BEFORE INSERT OR UPDATE ON public.peer_room_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_peer_room_message();

-- 3. Validation trigger for peer_rooms
CREATE OR REPLACE FUNCTION public.validate_peer_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML from text fields
  NEW.name := strip_html_tags(NEW.name);
  IF NEW.subject IS NOT NULL THEN
    NEW.subject := strip_html_tags(NEW.subject);
  END IF;
  IF NEW.topic IS NOT NULL THEN
    NEW.topic := strip_html_tags(NEW.topic);
  END IF;
  
  -- Enforce length limits
  IF length(NEW.name) > 100 THEN
    NEW.name := left(NEW.name, 100);
  END IF;
  IF NEW.subject IS NOT NULL AND length(NEW.subject) > 100 THEN
    NEW.subject := left(NEW.subject, 100);
  END IF;
  IF NEW.topic IS NOT NULL AND length(NEW.topic) > 200 THEN
    NEW.topic := left(NEW.topic, 200);
  END IF;
  
  -- Name must be at least 3 chars
  IF length(trim(NEW.name)) < 3 THEN
    RAISE EXCEPTION 'Room name must be at least 3 characters';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_peer_room ON public.peer_rooms;
CREATE TRIGGER trg_validate_peer_room
  BEFORE INSERT OR UPDATE ON public.peer_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_peer_room();

-- 4. Validation trigger for profiles
CREATE OR REPLACE FUNCTION public.validate_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML from display_name
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := strip_html_tags(NEW.display_name);
    IF length(NEW.display_name) > 100 THEN
      NEW.display_name := left(NEW.display_name, 100);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile ON public.profiles;
CREATE TRIGGER trg_validate_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile();

-- 5. Validation trigger for reviews
CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML
  NEW.content := strip_html_tags(NEW.content);
  NEW.display_name := strip_html_tags(NEW.display_name);
  
  -- Length limits
  IF length(NEW.content) > 2000 THEN
    NEW.content := left(NEW.content, 2000);
  END IF;
  IF length(NEW.display_name) > 100 THEN
    NEW.display_name := left(NEW.display_name, 100);
  END IF;
  
  -- Content must be at least 10 chars
  IF length(trim(NEW.content)) < 10 THEN
    RAISE EXCEPTION 'Review must be at least 10 characters';
  END IF;
  
  -- Rating must be 1-5
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_review ON public.reviews;
CREATE TRIGGER trg_validate_review
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_review();

-- 6. Validation trigger for student_teacher_messages
CREATE OR REPLACE FUNCTION public.validate_st_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML
  NEW.message := strip_html_tags(NEW.message);
  
  -- Length limit
  IF length(NEW.message) > 5000 THEN
    NEW.message := left(NEW.message, 5000);
  END IF;
  
  -- Reject empty
  IF trim(NEW.message) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_st_message ON public.student_teacher_messages;
CREATE TRIGGER trg_validate_st_message
  BEFORE INSERT OR UPDATE ON public.student_teacher_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_st_message();

-- 7. Validation trigger for chat_messages
CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Content length limit (AI responses can be long)
  IF length(NEW.content) > 50000 THEN
    NEW.content := left(NEW.content, 50000);
  END IF;
  
  -- Validate role
  IF NEW.role NOT IN ('user', 'assistant', 'system') THEN
    RAISE EXCEPTION 'Invalid message role';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_chat_message ON public.chat_messages;
CREATE TRIGGER trg_validate_chat_message
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_message();

-- 8. Validation trigger for student_help_requests
CREATE OR REPLACE FUNCTION public.validate_help_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Strip HTML
  NEW.question := strip_html_tags(NEW.question);
  NEW.subject := strip_html_tags(NEW.subject);
  IF NEW.topic IS NOT NULL THEN
    NEW.topic := strip_html_tags(NEW.topic);
  END IF;
  
  -- Length limits
  IF length(NEW.question) > 4000 THEN
    NEW.question := left(NEW.question, 4000);
  END IF;
  IF length(NEW.subject) > 100 THEN
    NEW.subject := left(NEW.subject, 100);
  END IF;
  IF NEW.topic IS NOT NULL AND length(NEW.topic) > 200 THEN
    NEW.topic := left(NEW.topic, 200);
  END IF;
  
  -- Non-empty checks
  IF trim(NEW.question) = '' THEN
    RAISE EXCEPTION 'Question cannot be empty';
  END IF;
  IF trim(NEW.subject) = '' THEN
    RAISE EXCEPTION 'Subject cannot be empty';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_help_request ON public.student_help_requests;
CREATE TRIGGER trg_validate_help_request
  BEFORE INSERT OR UPDATE ON public.student_help_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_help_request();
