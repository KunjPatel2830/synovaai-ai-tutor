-- Deny anonymous access to chat_messages table
CREATE POLICY "Deny anonymous access to chat_messages"
ON public.chat_messages
FOR ALL
TO anon
USING (false)
WITH CHECK (false);