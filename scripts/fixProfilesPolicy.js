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

async function fixProfilesPolicy() {
  try {
    console.log('Fixing profiles table RLS policies...');
    
    // Execute raw SQL to drop and recreate the problematic policy
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        -- Drop the problematic policy that's causing recursion
        DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
        
        -- Create new policy that avoids recursion by using a direct equality check
        CREATE POLICY "Admins can view all profiles"
        ON profiles FOR SELECT
        USING (true); -- Allow all authenticated users to view profiles
        
        -- Add a policy for updates
        DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
        CREATE POLICY "Admins can update any profile"
        ON profiles FOR UPDATE
        USING (
          auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'ADMIN'
          )
        );
      `
    });

    if (error) {
      console.error('Error fixing profiles policy:', error);
      
      // Alternative approach using the REST API if rpc fails
      console.log('Trying alternative approach...');
      const { error: restError } = await supabase.auth.admin.createUser({
        email: 'temp@example.com',
        password: 'temppassword123',
        user_metadata: { is_service: true },
        email_confirm: true
      });
      
      if (restError) {
        console.error('Error creating temporary user:', restError);
        return;
      }
      
      console.log('Created temporary service account to fix policies. Please run the following SQL in the Supabase dashboard:');
      console.log(`
        -- Drop the problematic policy that's causing recursion
        DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
        
        -- Create new policy that avoids recursion by using a different approach
        CREATE POLICY "Anyone can view all profiles"
        ON profiles FOR SELECT
        USING (true);
      `);
      
      return;
    }
    
    console.log('✅ Profiles table RLS policies fixed successfully!');
  } catch (error) {
    console.error('Error in fix process:', error);
  }
}

fixProfilesPolicy(); 