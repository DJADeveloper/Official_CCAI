'use client';

import { useState, useEffect } from 'react';
import { Button, Box, Typography, Paper, Alert, CircularProgress, Divider } from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Create a clean Supabase client instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DirectDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        console.log('Checking session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (!data.session) {
          setError('No active session found. Please log in first.');
          setIsLoading(false);
          return;
        }
        
        setSession(data.session);
        console.log('Session found, user ID:', data.session.user.id);
        
        // Check cookies to see if they contain auth info
        const cookies = document.cookie;
        setDebugInfo(prev => ({
          ...prev,
          cookies_exist: cookies.length > 0,
          cookies_preview: cookies.substring(0, 100) + (cookies.length > 100 ? '...' : '')
        }));
        
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
          
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setError(`Error fetching profile: ${profileError.message}`);
        } else {
          setProfile(profileData);
          console.log('Profile data:', profileData);
        }

        // Check if there's a token in localStorage
        const hasLocalStorageToken = !!localStorage.getItem('supabase.auth.token');
        setDebugInfo(prev => ({
          ...prev,
          hasLocalStorageToken,
          session_expires_at: data.session ? new Date(data.session.expires_at * 1000).toISOString() : 'N/A',
          user_id: data.session?.user.id || 'N/A'
        }));
      } catch (err) {
        console.error('Error checking authentication:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuth();
  }, []);
  
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      window.location.href = '/direct-login';
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Error signing out');
      setIsLoading(false);
    }
  };
  
  const goToMainDashboard = () => {
    router.push('/dashboard');
  };

  // This function attempts to ensure the session is available to the middleware
  const prepareSessionAndGo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      
      if (!data.session) {
        setError('No active session found. Please log in first.');
        setIsLoading(false);
        return;
      }
      
      // Force a refresh of the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
      } else {
        console.log('Session refreshed successfully');
      }
      
      // Now navigate to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Error preparing session:', err);
      setError(err instanceof Error ? err.message : 'Error preparing session');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Direct Dashboard</Typography>
        <Typography variant="subtitle1" gutterBottom color="text.secondary">
          Simplified dashboard that bypasses middleware and complex hooks
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        )}
        
        {!session && !error && (
          <Alert severity="warning" sx={{ my: 2 }}>
            No active session. Please <a href="/direct-login" style={{ fontWeight: 'bold' }}>log in</a> first.
          </Alert>
        )}
        
        {session && profile && (
          <Box sx={{ my: 3 }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              Successfully authenticated!
            </Alert>
            
            <Typography variant="h6" gutterBottom>User Information</Typography>
            <Box sx={{ mb: 3 }}>
              <Typography><strong>Email:</strong> {profile.email}</Typography>
              <Typography><strong>Name:</strong> {profile.full_name}</Typography>
              <Typography><strong>Role:</strong> {profile.role}</Typography>
              <Typography><strong>User ID:</strong> {profile.id}</Typography>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
              <Typography variant="h6">Try Different Methods to Access Dashboard:</Typography>
              
              <Button 
                variant="contained" 
                onClick={goToMainDashboard}
                sx={{ mb: 1 }}
              >
                Method 1: Go to Dashboard (Next.js Router)
              </Button>
              
              <Button 
                variant="contained" 
                color="secondary"
                onClick={() => window.location.href = '/dashboard'}
                sx={{ mb: 1 }}
              >
                Method 2: Go to Dashboard (Direct Browser Navigation)
              </Button>
              
              <Button 
                variant="contained" 
                color="primary"
                onClick={prepareSessionAndGo}
                sx={{ mb: 1 }}
              >
                Method 3: Refresh Session & Go to Dashboard
              </Button>
              
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        )}
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Debug Information:</Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography fontFamily="monospace" fontSize="14px" whiteSpace="pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
} 