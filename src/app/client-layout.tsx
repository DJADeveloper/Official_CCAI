'use client';

import React, { useState, useMemo, useEffect, createContext } from 'react';
import { AuthProvider } from "@/lib/hooks/useAuth";
// Remove next-themes ThemeProvider
// import { ThemeProvider } from "next-themes"; 
import { Toaster } from "react-hot-toast";
import { supabase } from '@/lib/supabase/client';

// Import MUI ThemeProvider, CssBaseline, createTheme, and the design tokens function
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getDesignTokens } from '@/theme/theme';
import { PaletteMode } from '@mui/material';

// Create the context
export const ColorModeContext = createContext({ toggleColorMode: () => {} });

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State to manage the theme mode
  const [mode, setMode] = useState<PaletteMode>('light'); // Default to light mode

  // TODO: Add logic to read preference from localStorage or system preference

  // Define the toggle function memoized (optional, but good practice)
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [], // No dependencies, function doesn't change
  );

  // Create the theme object dynamically based on the mode
  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

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
          if (data.session?.expires_at) {
            console.log('ClientLayout: Session expires at:', new Date(data.session.expires_at * 1000).toISOString());
          }
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
    // Provide the color mode context
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        {/* CssBaseline kickstarts an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline /> 
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
} 