-- Temporarily modify chat_messages SELECT RLS policy to allow all authenticated users
-- This is for debugging the Realtime subscription issue.

-- Drop the existing policy first (assuming the name from initial migration)
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;

-- Create a wide-open SELECT policy for authenticated users
CREATE POLICY "TEMP - Allow any authenticated user to select all messages" 
ON public.chat_messages FOR SELECT
TO authenticated
USING (true); -- Allows any authenticated user to select any row 