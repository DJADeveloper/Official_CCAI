const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service role key not found.');
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugAuth() {
  try {
    console.log('Checking database connection and tables...');
    
    // Check if tables exist and are accessible
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.error('Error accessing profiles table:', profilesError);
    } else {
      console.log(`✅ Successfully accessed profiles table. Found ${profilesData.length} records:`);
      console.log(JSON.stringify(profilesData, null, 2));
    }
    
    // Check RLS policies on profiles table
    console.log('\nChecking RLS policies on profiles table...');
    const { data: policiesData, error: policiesError } = await supabase.rpc('get_policies');
    
    if (policiesError) {
      console.log('Unable to query policies directly. The RPC function might not exist.');
      
      // Try an alternative approach to check if profiles can be accessed with admin key
      console.log('Checking if profiles table can be accessed with admin key...');
      const { data: adminProfilesData, error: adminProfilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);
      
      if (adminProfilesError) {
        console.error('Error accessing profiles with admin key:', adminProfilesError);
      } else {
        console.log(`✅ Admin key can access profiles table. Found ${adminProfilesData.length} records.`);
      }
      
      // Try to access a specific profile by ID
      console.log('\nTrying to access admin profile by ID...');
      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', '6c1fd469-005d-479c-9630-5ba01bd499af')
        .single();
      
      if (adminProfileError) {
        console.error('Error accessing admin profile by ID:', adminProfileError);
      } else {
        console.log('✅ Successfully accessed admin profile by ID:');
        console.log(JSON.stringify(adminProfile, null, 2));
      }
    } else {
      console.log('Policies retrieved:', policiesData);
    }
    
    // Create a test session to simulate authentication
    console.log('\nCreating a test authentication session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'admin@example.com',
    });
    
    if (sessionError) {
      console.error('Error creating test session:', sessionError);
    } else {
      console.log('✅ Generated auth link:');
      console.log(sessionData);
    }
  } catch (error) {
    console.error('Error in debug process:', error);
  }
}

debugAuth(); 