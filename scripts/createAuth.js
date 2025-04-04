const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or service key not found.');
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAuthToken() {
  try {
    console.log('Testing connection to Supabase...');
    
    // Try to sign in as admin user
    console.log('Attempting to sign in as admin@example.com...');
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'adminpassword123'
    });
    
    if (signInError) {
      console.error('Sign-in failed:', signInError.message);
      
      // If user doesn't exist, attempt to create one
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('User might not exist. Attempting to create admin@example.com...');
        
        // Using the service role key allows creating users without confirmation
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: 'admin@example.com',
          password: 'adminpassword123',
          email_confirm: true
        });
        
        if (createError) {
          console.error('Error creating user. This might be because:');
          console.error('1. Your Supabase version doesn\'t support this admin API');
          console.error('2. The user already exists but the password is different');
          console.error('3. There\'s a network or permission issue');
          console.error('\nTry creating the user manually in the Supabase Dashboard');
          console.error('Error details:', createError.message);
          
          console.log('\nTrying to check if user exists in profiles table...');
        }
      }
    } else {
      console.log('✅ Successfully signed in as admin@example.com');
      console.log('User ID:', signInData.user.id);
    }
    
    // Get admin profile from database
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', 'admin@example.com')
      .single();
    
    if (profileError) {
      console.error('Error retrieving profile:', profileError.message);
      
      if (profileError.message.includes('No rows found')) {
        console.log('Profile not found. Creating a new profile record...');
        
        // Get the user ID from the sign-in if we have it
        const userId = signInData?.user?.id;
        
        if (userId) {
          const { data: newProfile, error: insertError } = await adminClient
            .from('profiles')
            .insert({
              id: userId,
              email: 'admin@example.com',
              full_name: 'Admin User',
              role: 'ADMIN',
              created_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error('Error creating profile:', insertError.message);
          } else {
            console.log('✅ Admin profile created successfully!');
          }
        } else {
          console.error('Cannot create profile - no user ID available');
        }
      }
    } else {
      console.log('✅ Found admin profile');
      console.log('Profile ID:', profile.id);
      console.log('User role:', profile.role);
    }
    
    console.log('\nYou can now log in with:');
    console.log('Email: admin@example.com');
    console.log('Password: adminpassword123');
    console.log('\nPlease go to: http://localhost:3000/direct-login');
    console.log('This is a simplified login page that bypasses the middleware and complex hooks.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

createAuthToken(); 