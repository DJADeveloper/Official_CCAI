-- Add soft delete capability to profiles table

-- 1. Add the status column
ALTER TABLE public.profiles
ADD COLUMN status TEXT;

-- 2. Add a check constraint for allowed statuses
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive'));

-- 3. Set the default status for new profiles
ALTER TABLE public.profiles
ALTER COLUMN status SET DEFAULT 'active';

-- 4. Update existing profiles to have 'active' status
-- Important: Run this before adding NOT NULL constraint if you plan to add one
UPDATE public.profiles
SET status = 'active'
WHERE status IS NULL;

-- 5. Make the status column NOT NULL (optional, but recommended)
-- Uncomment the following lines if you want to enforce that status always has a value
-- ALTER TABLE public.profiles
-- ALTER COLUMN status SET NOT NULL;

-- 6. Add an index on the status column (optional, improves filtering performance)
CREATE INDEX idx_profiles_status ON public.profiles(status); 