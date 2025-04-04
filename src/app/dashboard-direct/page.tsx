'use client';

import { useState, useEffect } from 'react';
import { Button, Box, Typography, Paper, Container, Grid, CircularProgress } from '@mui/material';
import { Alert, Card, CardContent, Divider } from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/client';

// Create a clean Supabase client instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export default function DashboardDirectPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [residents, setResidents] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Check auth and load data
    async function loadDashboard() {
      try {
        console.log('Loading dashboard data...');
        
        // First try to get the session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (!sessionData.session) {
          setError('No active session found. Please log in first.');
          setIsLoading(false);
          return;
        }
        
        setUser(sessionData.session.user);
        setDebugInfo(prev => ({
          ...prev,
          user_id: sessionData.session?.user.id,
          session_expires_at: sessionData.session?.expires_at 
            ? new Date(sessionData.session.expires_at * 1000).toISOString() 
            : 'unknown'
        }));
        
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
        setDebugInfo(prev => ({
          ...prev,
          profile_role: profileData.role,
          profile_name: profileData.full_name
        }));
        
        // Load dashboard data based on role
        const { data: residentsData, error: residentsError } = await supabase
          .from('residents')
          .select('*')
          .limit(5);
          
        if (!residentsError && residentsData) {
          setResidents(residentsData);
        }
        
        const { data: incidentsData, error: incidentsError } = await supabase
          .from('incidents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (!incidentsError && incidentsData) {
          setIncidents(incidentsData);
        }
        
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: true })
          .limit(5);
          
        if (!eventsError && eventsData) {
          setEvents(eventsData);
        }
        
      } catch (err) {
        console.error('Dashboard loading error:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDashboard();
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

  if (error || !user || !profile) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Unable to load dashboard. Please log in again.'}
        </Alert>
        <Button variant="contained" onClick={() => window.location.href = '/direct-login'}>
          Go to Login
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Dashboard Direct</Typography>
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
          <Typography variant="h6" gutterBottom>Navigation Options</Typography>
          <Grid container spacing={2}>
            <Grid item>
              <Button variant="contained" href="/dashboard">
                Go to Main Dashboard
              </Button>
            </Grid>
            <Grid item>
              <Button variant="outlined" href="/direct-dashboard">
                Back to Direct Dashboard
              </Button>
            </Grid>
          </Grid>
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