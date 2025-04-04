const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Get Supabase URL and service role key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service role key not found.');
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.');
  process.exit(1);
}

// Create Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Functions to create and seed the database
async function createTables() {
  console.log('Creating tables...');
  
  try {
    // Check if profiles table exists by inserting a test record
    const { error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profileCheckError) {
      console.log('Profiles table does not exist, creating it...');
      // Unfortunately, we can't directly execute custom SQL with the JavaScript client
      // So we'll need to manually create this table in the Supabase dashboard or use
      // the REST API directly for schema manipulations
      console.log('Please run the SQL migration script in your Supabase dashboard:');
      console.log('1. Go to https://app.supabase.com/project/_/sql');
      console.log('2. Copy and paste the SQL from supabase/migrations/20240401000000_initial_schema.sql');
      console.log('3. Run the script');
      console.log('4. Then run this seed script again');
      return false;
    }

    console.log('Tables already exist, proceeding with seeding data...');
    return true;
  } catch (error) {
    console.error('Error checking tables:', error);
    return false;
  }
}

async function seedData() {
  console.log('Seeding data...');

  // Insert admin user
  const { error: adminError, data: adminData } = await supabase
    .from('profiles')
    .upsert([
      {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'ADMIN',
        created_at: new Date().toISOString()
      }
    ], { onConflict: 'id', returning: true });

  if (adminError) {
    console.error('Error inserting admin user:', adminError);
  } else {
    console.log('Admin user created or updated');
  }

  // Insert sample staff user
  const { error: staffError, data: staffData } = await supabase
    .from('profiles')
    .upsert([
      {
        email: 'staff@example.com',
        full_name: 'Staff User',
        role: 'STAFF',
        created_at: new Date().toISOString()
      }
    ], { onConflict: 'email', returning: true });

  if (staffError) {
    console.error('Error inserting staff user:', staffError);
  } else {
    console.log('Staff user created or updated');
    
    // Add staff details
    if (staffData && staffData.length > 0) {
      const { error: staffDetailsError } = await supabase
        .from('staff')
        .upsert([
          {
            profile_id: staffData[0].id,
            department: 'Nursing',
            position: 'Registered Nurse',
            shift: 'MORNING'
          }
        ], { onConflict: 'profile_id' });
      
      if (staffDetailsError) {
        console.error('Error inserting staff details:', staffDetailsError);
      } else {
        console.log('Staff details created or updated');
      }
    }
  }

  // Insert sample resident user
  const { error: residentError, data: residentData } = await supabase
    .from('profiles')
    .upsert([
      {
        email: 'resident@example.com',
        full_name: 'Resident User',
        role: 'RESIDENT',
        created_at: new Date().toISOString()
      }
    ], { onConflict: 'email', returning: true });

  if (residentError) {
    console.error('Error inserting resident user:', residentError);
  } else {
    console.log('Resident user created or updated');
    
    // Add resident details
    if (residentData && residentData.length > 0) {
      const { error: residentDetailsError } = await supabase
        .from('residents')
        .upsert([
          {
            profile_id: residentData[0].id,
            room_number: '101',
            emergency_contact: 'Family: 555-123-4567',
            medical_conditions: ['Diabetes', 'Hypertension'],
            care_level: 'MEDIUM'
          }
        ], { onConflict: 'profile_id' });
      
      if (residentDetailsError) {
        console.error('Error inserting resident details:', residentDetailsError);
      } else {
        console.log('Resident details created or updated');
      }
    }
  }

  // Insert sample events
  if (staffData && staffData.length > 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    const { error: eventsError } = await supabase
      .from('events')
      .upsert([
        {
          title: 'Bingo Night',
          description: 'Weekly bingo night in the recreation room',
          start_time: new Date(tomorrow.setHours(18, 0, 0, 0)).toISOString(),
          end_time: new Date(tomorrow.setHours(20, 0, 0, 0)).toISOString(),
          location: 'Recreation Room',
          organizer_id: staffData[0].id,
          attendees: residentData && residentData.length > 0 ? [residentData[0].id] : []
        },
        {
          title: 'Morning Exercise',
          description: 'Gentle exercise class for all residents',
          start_time: new Date(dayAfterTomorrow.setHours(10, 0, 0, 0)).toISOString(),
          end_time: new Date(dayAfterTomorrow.setHours(11, 0, 0, 0)).toISOString(),
          location: 'Garden',
          organizer_id: staffData[0].id,
          attendees: residentData && residentData.length > 0 ? [residentData[0].id] : []
        }
      ]);
    
    if (eventsError) {
      console.error('Error inserting events:', eventsError);
    } else {
      console.log('Events created or updated');
    }
  }

  // Insert sample incidents
  if (staffData && staffData.length > 0 && residentData && residentData.length > 0) {
    const { error: incidentsError } = await supabase
      .from('incidents')
      .upsert([
        {
          title: 'Fall in Hallway',
          description: 'Resident fell in hallway but no injuries',
          severity: 'MEDIUM',
          status: 'RESOLVED',
          reported_by: staffData[0].id,
          assigned_to: adminData && adminData.length > 0 ? adminData[0].id : null,
          resident_id: residentData[0].id
        },
        {
          title: 'Missed Medication',
          description: 'Resident missed evening medication',
          severity: 'HIGH',
          status: 'IN_PROGRESS',
          reported_by: adminData && adminData.length > 0 ? adminData[0].id : staffData[0].id,
          assigned_to: staffData[0].id,
          resident_id: residentData[0].id
        }
      ]);
    
    if (incidentsError) {
      console.error('Error inserting incidents:', incidentsError);
    } else {
      console.log('Incidents created or updated');
    }
  }

  console.log('✅ Seed data inserted successfully');
}

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    const tablesExist = await createTables();
    
    if (tablesExist) {
      await seedData();
      console.log('Database initialization completed successfully.');
    }
  } catch (error) {
    console.error('Error initializing database:', error.message);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase(); 