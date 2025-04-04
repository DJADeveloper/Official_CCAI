const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or anon key not found.');
  console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testLogin() {
  try {
    // Clear any existing sessions
    console.log('Signing out any existing sessions...');
    await supabase.auth.signOut();
    
    // Set login credentials
    const email = 'admin@example.com';
    const password = 'adminpassword123';
    
    console.log(`Testing login with ${email} and password...`);
    
    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Login error:', error);
      process.exit(1);
    }
    
    console.log('✅ Login successful!');
    console.log('Session:', data.session ? 'Active' : 'None');
    console.log('User ID:', data.user?.id);
    
    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    } else {
      console.log('Profile data:', profileData);
    }
    
    console.log('\nAuthentication is working correctly.');
    console.log('If the login page is not redirecting, check:');
    console.log('1. Browser cookies - try clearing them or using incognito mode');
    console.log('2. Network requests - check for any errors in the browser console');
    console.log('3. Make sure middleware.ts is updated with the latest code');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

testLogin(); 