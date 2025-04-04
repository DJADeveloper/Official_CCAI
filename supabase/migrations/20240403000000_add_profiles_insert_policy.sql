-- Add RLS policy to allow authenticated users to insert profiles
-- This is needed for creating residents where email might be NULL

CREATE POLICY "Allow authenticated users to insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (true); -- Allows insertion without specific checks on the data being inserted 