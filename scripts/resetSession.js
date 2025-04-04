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

async function resetSessions() {
  try {
    console.log('Resetting user admin session...');
    
    // Get the admin user information
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@example.com')
      .single();
    
    if (userError) {
      console.error('Error fetching admin user:', userError);
      return;
    }
    
    console.log('Found admin user with ID:', userData.id);
    
    // Terminate all sessions for the admin user
    const { error: sessionError } = await supabase.auth.admin.signOut(userData.id);
    
    if (sessionError) {
      console.error('Error terminating admin sessions:', sessionError);
      return;
    }
    
    console.log('✅ Admin user sessions terminated successfully!');
    console.log('Now try logging in again with:');
    console.log('Email: admin@example.com');
    console.log('Password: adminpassword123');
    
  } catch (error) {
    console.error('Error resetting sessions:', error);
  }
}

resetSessions(); 