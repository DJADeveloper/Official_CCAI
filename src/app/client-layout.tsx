'use client';

import { useEffect } from 'react';
import { AuthProvider } from "@/lib/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { supabase } from '@/lib/supabase/client';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize Supabase auth session as early as possible
  useEffect(() => {
    // Check for an existing session on client-side initialization
    const initializeAuth = async () => {
      try {
        console.log('ClientLayout: Initializing Supabase auth session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('ClientLayout: Error checking session:', error);
        } else if (data.session) {
          console.log('ClientLayout: Found existing session for user:', data.session.user.id);
          console.log('ClientLayout: Session expires at:', new Date(data.session.expires_at * 1000).toISOString());
        } else {
          console.log('ClientLayout: No active session found');
        }
        
        // Set up auth state change listener
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('ClientLayout: Auth state changed:', event);
          if (session) {
            console.log('ClientLayout: New session for user:', session.user.id);
          }
        });
        
        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (err) {
        console.error('ClientLayout: Error initializing auth:', err);
      }
    };
    
    initializeAuth();
  }, []);
  
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        {children}
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
} 