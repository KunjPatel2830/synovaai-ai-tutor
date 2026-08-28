-- Remove the overly restrictive deny-all policy that blocks authenticated users
DROP POLICY IF EXISTS "Deny anonymous access to chat_messages" ON public.chat_messages;