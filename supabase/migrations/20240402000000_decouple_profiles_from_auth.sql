-- Decouple profiles from auth.users table

-- 1. Drop the foreign key constraint linking profiles.id to auth.users.id
-- Assumes the default constraint name. Verify in Supabase dashboard if needed.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Ensure the id column defaults to a generated UUID (if not already the case)
-- This might already be handled by PRIMARY KEY, but setting default ensures it.
ALTER TABLE public.profiles
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. Make the email column nullable
ALTER TABLE public.profiles
ALTER COLUMN email DROP NOT NULL;

-- Note: The UNIQUE constraint on 'email' typically allows multiple NULLs in standard SQL.
-- If you encounter issues with multiple residents (NULL emails), you might need to
-- drop and recreate the unique constraint specifically for non-null values, but
-- let's proceed with just making it nullable for now. 