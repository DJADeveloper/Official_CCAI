-- Restore the original RLS policies for chat_messages after debugging

-- Drop the temporary permissive policy
DROP POLICY IF EXISTS "TEMP - Allow any authenticated user to select all messages" ON public.chat_messages;

-- Recreate the original SELECT policy
CREATE POLICY "Users can view their own messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id
);

-- Ensure the INSERT policy is still present (re-adding just in case)
-- Drop policy first to avoid error if it already exists
DROP POLICY IF EXISTS "Users can create messages" ON public.chat_messages;
CREATE POLICY "Users can create messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id); 