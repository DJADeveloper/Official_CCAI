-- Migration to create the medication_log table and RLS policies

-- 1. Create medication_log table
CREATE TABLE public.medication_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE, 
    administered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    administered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- Keep log even if staff leaves?
    status TEXT NOT NULL CHECK (status IN ('GIVEN', 'MISSED', 'REFUSED')), -- Add more statuses if needed
    notes TEXT
);

-- Add indexes for common query patterns
CREATE INDEX idx_medication_log_medication_id ON public.medication_log(medication_id);
CREATE INDEX idx_medication_log_resident_id ON public.medication_log(resident_id);
CREATE INDEX idx_medication_log_administered_at ON public.medication_log(administered_at);

-- 2. Enable RLS
ALTER TABLE public.medication_log ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for medication_log

-- Allow ADMIN and STAFF to view all logs
CREATE POLICY "Allow admin and staff to view medication logs" 
ON public.medication_log FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'STAFF')
);

-- Allow ADMIN and STAFF to insert logs, checking they are the ones administering
CREATE POLICY "Allow admin and staff to insert medication logs"
ON public.medication_log FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'STAFF') AND
    administered_by = auth.uid()
);

-- Add UPDATE/DELETE policies if needed later (e.g., only allow updates/deletes shortly after creation?) 