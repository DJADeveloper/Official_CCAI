const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The UUID from Supabase Authentication
const AUTH_USER_ID = '6c1fd469-005d-479c-9630-5ba01bd499af';

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

async function updateAdminUser() {
  try {
    console.log('Fetching existing admin user...');
    
    // Get the current admin user ID
    const { data: adminData, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@example.com')
      .single();
    
    if (adminError) {
      console.error('Error fetching admin user:', adminError);
      return;
    }
    
    console.log('Current admin ID:', adminData.id);
    console.log('New admin ID from Auth:', AUTH_USER_ID);
    
    // We'll take a different approach - insert a new admin profile with the Auth ID
    // and then move all associations to it
    
    // 1. Insert the new admin profile
    console.log('Creating new admin profile with Auth ID...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: AUTH_USER_ID,
        email: 'admin_new@example.com', // Temporary email to avoid unique constraint
        full_name: 'Admin User',
        role: 'ADMIN',
        created_at: new Date().toISOString()
      });
      
    if (insertError) {
      console.error('Error creating new admin profile:', insertError);
      return;
    }
    
    // 2. Update references to point to the new admin ID
    const tables = [
      { name: 'events', column: 'organizer_id' },
      { name: 'incidents', column: 'reported_by' },
      { name: 'incidents', column: 'assigned_to' },
      { name: 'medications', column: 'prescribed_by' },
      { name: 'announcements', column: 'author_id' },
      { name: 'care_plans', column: 'created_by' },
      { name: 'chat_messages', column: 'sender_id' },
      { name: 'chat_messages', column: 'receiver_id' },
      { name: 'notifications', column: 'user_id' },
      { name: 'tasks', column: 'assigned_to' },
      { name: 'todos', column: 'assigned_to' }
    ];
    
    for (const table of tables) {
      console.log(`Updating ${table.name}.${table.column}...`);
      const { error } = await supabase
        .from(table.name)
        .update({ [table.column]: AUTH_USER_ID })
        .eq(table.column, adminData.id);
        
      if (error) {
        console.log(`No updates needed for ${table.name}.${table.column} or error:`, error);
      }
    }
    
    // 3. Delete the old admin profile
    console.log('Deleting old admin profile...');
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', adminData.id);
      
    if (deleteError) {
      console.error('Error deleting old admin profile:', deleteError);
      return;
    }
    
    // 4. Update the email of the new admin profile
    console.log('Updating new admin profile email...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ email: 'admin@example.com' })
      .eq('id', AUTH_USER_ID);
      
    if (updateError) {
      console.error('Error updating new admin profile email:', updateError);
      return;
    }
    
    console.log('✅ Admin user ID updated successfully!');
    
  } catch (error) {
    console.error('Error updating admin user:', error);
  }
}

updateAdminUser(); 