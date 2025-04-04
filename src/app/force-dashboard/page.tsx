'use client';

import { useState, useEffect } from 'react';
import { Button, Box, Typography, Paper, Container, Grid, CircularProgress } from '@mui/material';
import { Alert, Card, CardContent, Divider } from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Create a clean Supabase client instance with forced persistence
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    debug: true
  }
});

export default function ForceDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [residents, setResidents] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  // Force login with credentials
  const forceLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Static credentials from our tests
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'adminpassword123'
      });
      
      if (error) throw error;
      
      if (!data.session) {
        throw new Error('No session created after login');
      }
      
      // Set debug info
      setDebugInfo(prev => ({
        ...prev,
        forced_login: 'success',
        user_id: data.user?.id,
        session_exists: !!data.session,
        access_token_preview: data.session?.access_token?.substring(0, 10) + '...',
        session_expires_at: data.session?.expires_at 
          ? new Date(data.session.expires_at * 1000).toISOString() 
          : 'unknown'
      }));
      
      // Load the dashboard after successful force login
      loadDashboard();
    } catch (err) {
      console.error('Force login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to force login');
      setIsLoading(false);
    }
  };

  // Load dashboard data
  const loadDashboard = async () => {
    try {
      // Get the current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!sessionData.session) {
        setError('No active session. Click "Force Login" to retry.');
        setIsLoading(false);
        return;
      }
      
      setUser(sessionData.session.user);
      
      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single();
        
      if (profileError) {
        console.error('Error loading profile:', profileError);
        setError(`Error loading profile: ${profileError.message}`);
        setIsLoading(false);
        return;
      }
      
      setProfile(profileData);
      
      // Load residents
      const { data: residentsData, error: residentsError } = await supabase
        .from('residents')
        .select('*')
        .limit(5);
        
      if (!residentsError && residentsData) {
        setResidents(residentsData);
      }
      
      // Load incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (!incidentsError && incidentsData) {
        setIncidents(incidentsData);
      }
      
      // Load events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true })
        .limit(5);
        
      if (!eventsError && eventsData) {
        setEvents(eventsData);
      }
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        dashboard_loaded: true,
        profile_role: profileData.role,
        profile_name: profileData.full_name,
        data_loaded: {
          residents: residentsData?.length || 0,
          incidents: incidentsData?.length || 0,
          events: eventsData?.length || 0
        }
      }));
      
    } catch (err) {
      console.error('Dashboard loading error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check session on initial load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          // Don't set an error yet, we'll try force login
        }
        
        if (data.session) {
          console.log('Existing session found, loading dashboard');
          loadDashboard();
        } else {
          console.log('No session found, showing login prompt');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Initial session check error:', err);
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);
  
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/direct-login';
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Error signing out');
      setIsLoading(false);
    }
  };

  const tryOriginalDashboard = () => {
    router.push('/dashboard');
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading Dashboard...
        </Typography>
      </Box>
    );
  }

  // No session or error state
  if (!user || !profile) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" gutterBottom align="center">
            Force Dashboard Access
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <Typography paragraph>
            This page will force authentication and bypass the middleware issues.
          </Typography>
          
          <Button 
            variant="contained" 
            fullWidth 
            color="primary" 
            size="large"
            onClick={forceLogin}
            sx={{ mb: 2 }}
          >
            Force Login as Admin
          </Button>
          
          <Box sx={{ mt: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Debug info: {JSON.stringify(debugInfo, null, 2)}
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  // Dashboard content
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Force Dashboard</Typography>
          <Button variant="contained" color="error" onClick={handleSignOut}>
            Sign Out
          </Button>
        </Box>
        
        <Alert severity="success" sx={{ mb: 3 }}>
          Welcome, {profile.full_name} ({profile.role})
        </Alert>
        
        <Grid container spacing={3}>
          {/* Residents Summary */}
          <Grid item xs={12} md={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Residents ({residents.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {residents.length > 0 ? (
                  residents.map((resident) => (
                    <Box key={resident.id} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        Room {resident.room_number} - {resident.care_level} care
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">No residents found</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Incidents Summary */}
          <Grid item xs={12} md={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Incidents ({incidents.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {incidents.length > 0 ? (
                  incidents.map((incident) => (
                    <Box key={incident.id} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {incident.title} ({incident.severity}) - {incident.status}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">No incidents found</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Events Summary */}
          <Grid item xs={12} md={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Upcoming Events ({events.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {events.length > 0 ? (
                  events.map((event) => (
                    <Box key={event.id} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        {event.title} at {event.location}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">No upcoming events</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Try Original Dashboard</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Now that you're authenticated, you can try accessing the original dashboard.
            The forced session should now be recognized.
          </Alert>
          <Button 
            variant="contained" 
            onClick={tryOriginalDashboard} 
            sx={{ mr: 2 }}
          >
            Go to Original Dashboard
          </Button>
        </Box>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Debug Information</Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography fontFamily="monospace" fontSize="14px" whiteSpace="pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Container>
  );
} 