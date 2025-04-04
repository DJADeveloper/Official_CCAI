-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'FAMILY', 'RESIDENT')),
    avatar_url TEXT
);

-- Create residents table
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    emergency_contact TEXT NOT NULL,
    medical_conditions TEXT[] DEFAULT '{}',
    care_level TEXT NOT NULL CHECK (care_level IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- Create staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('MORNING', 'AFTERNOON', 'NIGHT'))
);

-- Create events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT NOT NULL,
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    attendees UUID[] DEFAULT '{}'
);

-- Create incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    reported_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES profiles(id),
    resident_id UUID REFERENCES residents(id)
);

-- Create medications table
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescribed_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create announcements table
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create care_plans table
CREATE TABLE care_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    goals TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create care_routines table
CREATE TABLE care_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    care_plan_id UUID REFERENCES care_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency TEXT NOT NULL,
    time_of_day TEXT NOT NULL,
    assigned_to UUID[] DEFAULT '{}'
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INFO', 'WARNING', 'ALERT')),
    read BOOLEAN DEFAULT FALSE
);

-- Create tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED'))
);

-- Create todos table
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed BOOLEAN DEFAULT FALSE
);

-- Function to get the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER -- Important for accessing profiles table within the function
SET search_path = public -- Ensure it finds the profiles table
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

-- Create RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- Residents policies
CREATE POLICY "Staff and admins can view all residents"
    ON residents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

CREATE POLICY "Family members can view their resident"
    ON residents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'FAMILY'
        )
    );

-- Staff policies
CREATE POLICY "Everyone can view staff"
    ON staff FOR SELECT
    TO authenticated
    USING (true);

-- Events policies
CREATE POLICY "Everyone can view events"
    ON events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Staff and admins can create events"
    ON events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Incidents policies
CREATE POLICY "Staff and admins can view all incidents"
    ON incidents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

CREATE POLICY "Staff and admins can create incidents"
    ON incidents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Medications policies
CREATE POLICY "Staff and admins can view all medications"
    ON medications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

CREATE POLICY "Staff and admins can create medications"
    ON medications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Announcements policies
CREATE POLICY "Everyone can view announcements"
    ON announcements FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Staff and admins can create announcements"
    ON announcements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Care plans policies
CREATE POLICY "Staff and admins can view all care plans"
    ON care_plans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

CREATE POLICY "Staff and admins can create care plans"
    ON care_plans FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Care routines policies
CREATE POLICY "Staff and admins can view all care routines"
    ON care_routines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

CREATE POLICY "Staff and admins can create care routines"
    ON care_routines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Chat messages policies
CREATE POLICY "Users can view their own messages"
    ON chat_messages FOR SELECT
    USING (
        auth.uid() = sender_id OR
        auth.uid() = receiver_id
    );

CREATE POLICY "Users can create messages"
    ON chat_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can view their own tasks"
    ON tasks FOR SELECT
    USING (auth.uid() = assigned_to);

CREATE POLICY "Staff and admins can create tasks"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'STAFF')
        )
    );

-- Todos policies
CREATE POLICY "Users can view their own todos"
    ON todos FOR SELECT
    USING (auth.uid() = assigned_to);

CREATE POLICY "Users can create their own todos"
    ON todos FOR INSERT
    WITH CHECK (auth.uid() = assigned_to);

-- Allow Admins to insert into the staff table
CREATE POLICY "Allow admin insert access for staff"
    ON public.staff FOR INSERT
    TO authenticated
    WITH CHECK (public.get_my_role() = 'ADMIN');

-- Allow Admins/Staff to view staff details
CREATE POLICY "Allow admin/staff select access for staff"
    ON public.staff FOR SELECT
    TO authenticated
    USING (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Add UPDATE/DELETE policies as needed, mirroring the resident ones

-- Seed initial data
INSERT INTO profiles (email, full_name, role)
VALUES
    ('admin@example.com', 'Admin User', 'ADMIN'),
    ('staff@example.com', 'Staff User', 'STAFF'),
    ('family@example.com', 'Family User', 'FAMILY'),
    ('resident@example.com', 'Resident User', 'RESIDENT');

-- Insert a sample resident
INSERT INTO residents (profile_id, room_number, emergency_contact, medical_conditions, care_level)
VALUES
    (
        (SELECT id FROM profiles WHERE email = 'resident@example.com'),
        '101',
        'Emergency Contact: 123-456-7890',
        ARRAY['Hypertension', 'Diabetes'],
        'MEDIUM'
    );

-- Insert a sample staff member
INSERT INTO staff (profile_id, department, position, shift)
VALUES
    (
        (SELECT id FROM profiles WHERE email = 'staff@example.com'),
        'Nursing',
        'Registered Nurse',
        'MORNING'
    );

-- Insert a sample event
INSERT INTO events (title, description, start_time, end_time, location, organizer_id, attendees)
VALUES
    (
        'Weekly Exercise Class',
        'Join us for a gentle exercise class suitable for all residents',
        NOW() + INTERVAL '1 day',
        NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
        'Activity Room',
        (SELECT id FROM profiles WHERE email = 'staff@example.com'),
        ARRAY[(SELECT id FROM profiles WHERE email = 'resident@example.com')]
    );

-- Insert a sample announcement
INSERT INTO announcements (title, content, author_id, priority)
VALUES
    (
        'Facility Maintenance Notice',
        'Scheduled maintenance will be conducted tomorrow morning. Please be aware of temporary noise.',
        (SELECT id FROM profiles WHERE email = 'admin@example.com'),
        'MEDIUM'
    );

-- Insert a sample care plan
INSERT INTO care_plans (resident_id, title, description, goals, created_by)
VALUES
    (
        (SELECT id FROM residents WHERE profile_id = (SELECT id FROM profiles WHERE email = 'resident@example.com')),
        'General Health Care Plan',
        'Comprehensive care plan for resident health and well-being',
        ARRAY['Maintain stable blood pressure', 'Regular exercise', 'Balanced diet'],
        (SELECT id FROM profiles WHERE email = 'staff@example.com')
    );

-- Insert a sample task
INSERT INTO tasks (title, description, assigned_to, due_date, priority, status)
VALUES
    (
        'Morning Medication Administration',
        'Administer prescribed medications to residents',
        (SELECT id FROM profiles WHERE email = 'staff@example.com'),
        NOW() + INTERVAL '1 day',
        'HIGH',
        'TODO'
    );

-- Insert a sample todo
INSERT INTO todos (title, description, assigned_to, due_date)
VALUES
    (
        'Schedule Doctor Appointment',
        'Schedule follow-up appointment with primary care physician',
        (SELECT id FROM profiles WHERE email = 'staff@example.com'),
        NOW() + INTERVAL '1 week'
    ); 