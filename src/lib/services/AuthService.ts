'use client';

import { supabase } from '@/lib/supabase/client';

export class AuthService {
  /**
   * Sign in with email and password, then redirect directly
   */
  static async signIn(email: string, password: string): Promise<void> {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      console.log('AuthService: Attempting sign in with email', email);
      
      // Clear any existing session first for a clean login
      try {
        console.log('AuthService: Clearing existing session');
        await supabase.auth.signOut();
        console.log('AuthService: Existing session cleared');
      } catch (signOutErr) {
        console.warn('AuthService: Error during sign out, continuing anyway:', signOutErr);
        // Continue with sign in even if sign out fails
      }
      
      console.log('AuthService: Starting login request to Supabase');
      // Sign in with Supabase with timeout protection
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login request timed out after 10 seconds'));
        }, 10000);
      });
      
      // Race the auth request with the timeout
      const { data, error } = await Promise.race([
        signInPromise,
        timeoutPromise
      ]) as any;

      // Handle authentication error
      if (error) {
        console.error('AuthService: Sign in error', error);
        throw error;
      }

      if (!data?.session) {
        console.error('AuthService: No session returned');
        throw new Error('Failed to create session');
      }

      console.log('AuthService: Sign in successful for user', data.user?.id);
      console.log('AuthService: Session expires at', new Date(data.session.expires_at * 1000).toISOString());
      
      // Check if the session is actually in localStorage
      const sessionFromStorage = localStorage.getItem('supabase.auth.token');
      console.log('AuthService: Session in localStorage:', !!sessionFromStorage);
      
      return;
    } catch (error) {
      console.error('AuthService: Unexpected error during sign in', error);
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      console.log('AuthService: Starting authentication check');
      
      // First check localStorage for session
      const sessionFromStorage = localStorage.getItem('supabase.auth.token');
      console.log('AuthService: Session token in localStorage:', !!sessionFromStorage);
      
      // Create a timeout promise that resolves to false after 3 seconds
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.log('AuthService: Authentication check timed out');
          resolve(false);
        }, 3000);
      });

      // Race the authentication check with the timeout
      const authCheckPromise = async (): Promise<boolean> => {
        try {
          console.log('AuthService: Calling supabase.auth.getSession()');
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('AuthService: Error from getSession():', error);
            return false;
          }
          
          const hasSession = !!data.session;
          console.log('AuthService: Session check complete, hasSession =', hasSession);
          if (hasSession) {
            console.log('AuthService: User ID =', data.session?.user.id);
            console.log('AuthService: Session expires at', 
              data.session ? new Date(data.session.expires_at * 1000).toISOString() : 'N/A');
          }
          
          return hasSession;
        } catch (error) {
          console.error('AuthService: Error checking authentication', error);
          return false;
        }
      };

      // Use Promise.race to prevent hanging if getSession takes too long
      return await Promise.race([
        authCheckPromise(),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('AuthService: Error in isAuthenticated', error);
      return false;
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<void> {
    try {
      console.log('AuthService: Signing out');
      await supabase.auth.signOut();
      console.log('AuthService: Sign out successful');
      
      // For good measure, clear local storage supabase items
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.expires_at');
    } catch (error) {
      console.error('AuthService: Error during sign out', error);
      throw error;
    }
  }
} 