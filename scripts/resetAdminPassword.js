const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The admin user's ID from Supabase Authentication
const ADMIN_USER_ID = '6c1fd469-005d-479c-9630-5ba01bd499af';
// New password with minimum 6 characters
const NEW_PASSWORD = 'adminpassword123';

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

async function resetAdminPassword() {
  try {
    console.log(`Resetting password for admin user (ID: ${ADMIN_USER_ID})...`);
    
    // Using the admin API to update the user's password
    const { error } = await supabase.auth.admin.updateUserById(
      ADMIN_USER_ID,
      { password: NEW_PASSWORD }
    );
    
    if (error) {
      console.error('Error resetting admin password:', error);
      return;
    }
    
    console.log('✅ Admin password reset successfully!');
    console.log(`Email: admin@example.com`);
    console.log(`Password: ${NEW_PASSWORD}`);
    
  } catch (error) {
    console.error('Error in reset process:', error);
  }
}

resetAdminPassword(); 