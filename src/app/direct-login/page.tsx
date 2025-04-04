'use client';

import { useState } from 'react';
import { Button, Box, Typography, Paper, Alert, CircularProgress, TextField } from '@mui/material';
import { Session, User } from '@supabase/supabase-js'; // Import Session and User types
import { supabase } from '@/lib/supabase/client';

// Get URL and Key from environment variables for checks/debug
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Define a type for the result state for better type safety
interface ResultState {
  status?: 'starting' | 'error' | 'success' | 'redirecting';
  timestamp: string;
  error?: string;
  user?: User | null; // Use specific User type
  session?: {
    access_token: string | null | undefined;
    refresh_token: string | null | undefined;
    expires_at: number | null | undefined;
    user_id: string | null | undefined;
  } | null;
  profileCheck?: { status: 'error' | 'success'; error?: string; role?: string; email?: string };
  sessionCheck?: { hasSession: boolean; session: any | null; hasLocalStorageSession: boolean };
  signOut?: string;
  redirecting?: boolean;
}

export default function DirectLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  const attemptLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult({
        status: 'starting',
        timestamp: new Date().toISOString()
      });

      // Simple direct login with hard-coded credentials
      console.log('Starting direct login with Supabase');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'adminpassword123'
      });

      if (error) {
        console.error('Login failed:', error);
        setError(error.message);
        setResult((prev) => ({
          ...(prev || { timestamp: '' }), // Ensure prev is not null
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      console.log('Login successful:', data);
      setResult((prev) => ({
        ...(prev || { timestamp: '' }),
        status: 'success',
        user: data.user,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user_id: data.session.user?.id
        } : null,
        timestamp: new Date().toISOString()
      }));

      // Get profile to confirm we can access the database
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setResult(prev => ({
            ...(prev || { timestamp: '' }),
            profileCheck: {
              status: 'error',
              error: profileError.message
            }
          }));
        } else {
          console.log('Profile fetch successful:', profileData);
          setResult(prev => ({
            ...(prev || { timestamp: '' }),
            profileCheck: {
              status: 'success',
              role: profileData.role,
              email: profileData.email
            }
          }));
        }
      } catch (profileErr) {
        console.error('Unexpected error fetching profile:', profileErr);
      }

      // After successful login, wait a moment before redirecting
      setTimeout(() => {
        console.log('Redirecting to dashboard...');
        setResult(prev => ({
          ...(prev || { timestamp: '' }),
          redirecting: true
        }));
        window.location.href = '/dashboard';
      }, 3000);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResult({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Signing out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        setError(error.message);
        return;
      }
      
      setResult({
        signOut: 'Success',
        timestamp: new Date().toISOString()
      });
      
      console.log('Sign out successful');
    } catch (err) {
      console.error('Error during sign out:', err);
      setError(err instanceof Error ? err.message : 'Error signing out');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Checking session...');
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setError(error.message);
        return;
      }
      
      console.log('Session check result:', data);
      
      // Also check local storage - use env var for URL
      const localStorageKey = `sb-${supabaseUrl.replace(/https?:\/\//, '').split('.')[0]}-auth-token`;
      const hasLocalStorageSession = localStorage.getItem(localStorageKey);
      
      setResult({
        sessionCheck: {
          hasSession: !!data.session,
          session: data.session ? {
            user_id: data.session.user.id,
            expires_at: data.session.expires_at,
            // Access created_at from user object if needed, or omit if not present on session
            // created_at: data.session.user.created_at 
          } : null,
          hasLocalStorageSession: !!hasLocalStorageSession
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error checking session:', err);
      setError(err instanceof Error ? err.message : 'Error checking session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          mx: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Direct Login Test
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom align="center" sx={{ mb: 3 }}>
          Bypasses middleware and custom hooks
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
          </Box>
        )}

        {result?.status === 'success' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Login successful! Redirecting in 3 seconds...
          </Alert>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={attemptLogin}
          disabled={isLoading || result?.status === 'success'}
          sx={{ mb: 2 }}
        >
          Login as Admin
        </Button>

        <Button
          variant="outlined"
          fullWidth
          onClick={checkSession}
          disabled={isLoading}
          sx={{ mb: 2 }}
        >
          Check Current Session
        </Button>

        <Button
          variant="outlined"
          color="error"
          fullWidth
          onClick={handleSignOut}
          disabled={isLoading}
          sx={{ mb: 2 }}
        >
          Sign Out
        </Button>

        {result && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Result:
            </Typography>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '300px',
                overflow: 'auto',
                fontSize: '12px'
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </Box>
        )}
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="caption" color="text.secondary">
            {/* Use env vars for debug output */}
            Debug info: {supabaseUrl ? 'Supabase URL: ✓' : 'Supabase URL: ✗'}, 
            {supabaseKey ? ' API Key: ✓' : ' API Key: ✗'}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
} 