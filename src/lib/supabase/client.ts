'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// We'll omit the Database type for now to resolve the import error
// import { Database } from './database.types'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Use createClientComponentClient for client-side Supabase access in App Router
export const supabase = createClientComponentClient(
  // Omit the <Database> generic for now
  // <Database> 
  {
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  }
);

// Remove the old Database definition if it was here
/*
export type Database = {
  public: {
    Tables: {
      // ... your table definitions ...
    };
  };
};
*/ 